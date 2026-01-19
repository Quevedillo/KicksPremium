import type { APIRoute } from 'astro';
import { stripe } from '@lib/stripe';
import { supabase } from '@lib/supabase';
import { sendOrderConfirmationEmail, sendAdminOrderNotification } from '@lib/email';
import Stripe from 'stripe';

// Handle Stripe webhooks
export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get('stripe-signature');
  
  if (!sig) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await request.text();
    
    // Get webhook secret from env
    const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('STRIPE_WEBHOOK_SECRET not configured');
      // Still process events for testing
    }

    let event: Stripe.Event;

    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return new Response('Invalid signature', { status: 400 });
      }
    } else {
      // For testing without webhook secret
      event = JSON.parse(body);
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.user_id) {
        const userId = session.metadata.user_id;
        const cartItems = JSON.parse(session.metadata.cart_items || '[]');

        // Calculate total from session - use amount_total if available, otherwise calculate from line items
        let total = session.amount_total || 0;
        
        console.log(`\n===== WEBHOOK RECEIVED =====`);
        console.log(`Session ID: ${session.id}`);
        console.log(`User ID: ${userId}`);
        console.log(`Amount Total: ${session.amount_total}`);
        console.log(`Cart Items Count: ${cartItems.length}`);
        console.log(`Cart Items:`, JSON.stringify(cartItems, null, 2));
        
        // If amount_total is 0 or missing, fetch the full session details with line items
        if (total === 0 && session.id) {
          console.log(`Total is 0, fetching full session from Stripe...`);
          try {
            const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
              expand: ['line_items'],
            });
            total = fullSession.amount_total || 0;
            console.log(`Retrieved full session total: ${total} cents for session ${session.id}`);
          } catch (err) {
            console.error('Error retrieving full session:', err);
          }
        }

        console.log(`Final total: ${total} cents (${(total / 100).toFixed(2)}€)`);
        console.log(`===========================\n`);

        // Create order in Supabase
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: userId,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            total_amount: total, // Keep in cents (integer)
            status: 'completed',
            shipping_name: (session as any).shipping?.name || null,
            shipping_address: JSON.stringify((session as any).shipping?.address) || null,
            shipping_phone: session.customer_details?.phone || null,
            billing_email: session.customer_email || null,
            items: cartItems,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError) {
          console.error('Error saving order to Supabase:', orderError);
        } else {
          console.log(`Order saved for user ${userId}`);

          // Decrement stock for each item in the order
          try {
            console.log(`Starting stock decrement for ${cartItems.length} items...`);
            for (const item of cartItems) {
              const productId = item.id;
              const quantity = item.qty || 1;
              const size = item.size;

              console.log(`\n  Processing item: ${productId} (qty: ${quantity}, size: ${size})`);

              // Get current product
              const { data: product, error: fetchError } = await supabase
                .from('products')
                .select('stock, sizes_available')
                .eq('id', productId)
                .single();

              if (fetchError || !product) {
                console.error(`    ERROR: Could not fetch product ${productId}:`, fetchError);
                continue;
              }

              console.log(`    Current stock: ${product.stock}, sizes_available:`, product.sizes_available);

              // Decrement stock for specific size
              let newSizesAvailable = product.sizes_available || {};
              if (newSizesAvailable && typeof newSizesAvailable === 'object' && size) {
                if (newSizesAvailable[size]) {
                  newSizesAvailable[size] = Math.max(0, (newSizesAvailable[size] || 0) - quantity);
                }
              }

              // Recalculate total stock from sizes (sum of all sizes)
              const newStock = Object.values(newSizesAvailable).reduce((sum: number, qty: any) => sum + (parseInt(qty) || 0), 0);

              console.log(`    Size ${size}: Decremented by ${quantity}, new quantity: ${newSizesAvailable[size] || 0}`);
              console.log(`    New total stock: ${product.stock} -> ${newStock}, new sizes_available:`, newSizesAvailable);

              // Update product stock
              const { error: updateError } = await supabase
                .from('products')
                .update({
                  stock: newStock,
                  sizes_available: newSizesAvailable,
                })
                .eq('id', productId);

              if (updateError) {
                console.error(`    ERROR updating stock for product ${productId}:`, updateError);
              } else {
                console.log(`    SUCCESS: Stock updated: ${product.stock} -> ${newStock}`);
              }
            }
            console.log(`Stock decrement completed.\n`);
          } catch (error) {
            console.error('ERROR in stock decrement loop:', error);
          }

          // Send order confirmation email
          try {
            if (order && session.customer_email) {
              // Get customer details for email
              const customerName = (session as any).shipping?.name || 'Cliente';
              
              // Parse shipping address
              let shippingAddress = undefined;
              if ((session as any).shipping?.address) {
                shippingAddress = (session as any).shipping.address;
              }

              // Calculate subtotal, tax
              const subtotal = cartItems.reduce(
                (sum: number, item: any) => sum + item.price * item.quantity,
                0
              );
              const tax = total - subtotal;

              const orderDetails = {
                orderId: order.id,
                email: session.customer_email,
                customerName,
                items: cartItems,
                subtotal,
                tax,
                total,
                shippingAddress,
                stripeSessionId: session.id,
              };

              // Enviar email de confirmación al cliente
              try {
                const confirmResult = await sendOrderConfirmationEmail(orderDetails);
                console.log(`✅ Order confirmation email sent to ${session.customer_email}`);
              } catch (confirmError) {
                console.error(`⚠️ Failed to send confirmation (will not block):`, confirmError);
              }

              // Enviar notificación al admin
              try {
                const adminResult = await sendAdminOrderNotification(orderDetails);
                console.log(`✅ Admin notification email sent`);
              } catch (adminEmailError) {
                console.error('⚠️ Failed to send admin notification (will not block):', adminEmailError);
              }
            }
          } catch (emailError) {
            console.error('Error sending order confirmation email:', emailError);
            // Don't fail the webhook if email fails
          }
        }
      }
    }

    // Handle payment_intent.payment_failed event
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('Payment failed:', paymentIntent.id);
      
      if (paymentIntent.metadata?.user_id) {
        const userId = paymentIntent.metadata.user_id;
        
        // Save failed order for audit
        await supabase
          .from('orders')
          .insert({
            user_id: userId,
            stripe_payment_intent_id: paymentIntent.id,
            status: 'failed',
            total_amount: paymentIntent.amount || 0, // Keep in cents (integer)
            items: JSON.parse(paymentIntent.metadata.cart_items || '[]'),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
