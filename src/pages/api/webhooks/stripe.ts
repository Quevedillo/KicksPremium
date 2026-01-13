import type { APIRoute } from 'astro';
import { stripe } from '@lib/stripe';
import { supabase } from '@lib/supabase';
import { sendOrderConfirmationEmail } from '@lib/email';
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

        // Calculate total from session
        const total = session.amount_total || 0;

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

              await sendOrderConfirmationEmail({
                orderId: order.id,
                email: session.customer_email,
                customerName,
                items: cartItems,
                subtotal,
                tax,
                total,
                shippingAddress,
                stripeSessionId: session.id,
              });
              console.log(`Order confirmation email sent to ${session.customer_email}`);
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
