import type { APIRoute } from 'astro';
import { stripe } from '@lib/stripe';
import { getSupabaseServiceClient } from '@lib/supabase';
import { sendOrderConfirmationEmail, sendAdminOrderNotification } from '@lib/email';
import { generateInvoicePDF } from '@lib/invoice';
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

      // Use service client to bypass RLS for stock updates
      const supabase = getSupabaseServiceClient();

      const userId = session.metadata?.user_id || null;
      
      // Parse cart items from metadata (supports chunked format)
      let cartItemsRaw: string;
      if (session.metadata?.cart_items) {
        cartItemsRaw = session.metadata.cart_items;
      } else if (session.metadata?.cart_items_chunks) {
        const chunkCount = parseInt(session.metadata.cart_items_chunks);
        cartItemsRaw = '';
        for (let i = 0; i < chunkCount; i++) {
          cartItemsRaw += session.metadata[`cart_items_${i}`] || '';
        }
      } else {
        cartItemsRaw = '[]';
      }
      const rawCartItems = JSON.parse(cartItemsRaw);
      
      // Enrich compact cart items with full product data from DB
      const cartItems = [];
      for (const item of rawCartItems) {
        const productId = item.id;
        let name = item.n || item.name || 'Producto';
        let brand = item.brand || '';
        let img = item.img || '';
        const price = item.p ?? item.price ?? 0;
        const qty = item.q ?? item.qty ?? 1;
        const size = item.s ?? item.size ?? '';
        
        // Fetch full product data if compact format (missing img/brand)
        if (!img || !brand) {
          try {
            const { data: product } = await supabase
              .from('products')
              .select('name, brand, images')
              .eq('id', productId)
              .single();
            if (product) {
              name = product.name || name;
              brand = product.brand || brand;
              img = product.images?.[0] || img;
            }
          } catch (e) {
            console.warn(`Could not fetch product ${productId} for enrichment`);
          }
        }
        
        cartItems.push({ id: productId, name, brand, price, qty, size, img });
      }
      
      const guestEmail = session.metadata?.guest_email || session.customer_email || null;

      // Calculate total from session - use amount_total if available, otherwise calculate from line items
      let total = session.amount_total || 0;
      
      console.log(`\n===== WEBHOOK RECEIVED =====`);
      console.log(`Session ID: ${session.id}`);
      console.log(`User ID: ${userId || 'GUEST'}`);
      console.log(`Guest Email: ${guestEmail || 'N/A'}`);
      console.log(`Amount Total: ${session.amount_total}`);
      console.log(`Cart Items Count: ${cartItems.length}`);
      console.log(`Cart Items:`, JSON.stringify(cartItems, null, 2));
      
      // If amount_total is 0 or missing, fetch the full session details with line items
      if ((total === 0 || total === null) && session.id) {
        console.log(`Total is 0 or null, fetching full session from Stripe...`);
        try {
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items'],
          });
          total = fullSession.amount_total || 0;
          console.log(`Retrieved full session total: ${total} cents for session ${session.id}`);
          
          // If still 0, calculate from cart items metadata
          if ((total === 0 || total === null) && cartItems.length > 0) {
            console.log(`Amount total is still 0, calculating from cart items...`);
            total = cartItems.reduce((sum: number, item: any) => {
              const itemPrice = item.price < 100 ? item.price * 100 : item.price;
              return sum + (itemPrice * item.qty);
            }, 0);
            console.log(`Calculated total from cart items: ${total} cents (${(total / 100).toFixed(2)}€)`);
          }
        } catch (err) {
          console.error('Error retrieving full session:', err);
          // Fall back to calculating from cart items
          if (cartItems.length > 0) {
            console.log(`Failed to fetch session, calculating from cart items...`);
            total = cartItems.reduce((sum: number, item: any) => {
              const itemPrice = item.price < 100 ? item.price * 100 : item.price;
              return sum + (itemPrice * item.qty);
            }, 0);
            console.log(`Fallback calculated total: ${total} cents (${(total / 100).toFixed(2)}€)`);
          }
        }
      }

      console.log(`Final total: ${total} cents (${(total / 100).toFixed(2)}€)`);
      console.log(`===========================\n`);

      // Create order in Supabase (user_id is null for guest checkout)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId || null,
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          total_amount: total,
          status: 'completed',
          shipping_name: (session as any).shipping?.name || null,
          shipping_address: JSON.stringify((session as any).shipping?.address) || null,
          shipping_phone: session.customer_details?.phone || null,
          billing_email: guestEmail || session.customer_email || null,
          items: cartItems,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error saving order to Supabase:', orderError);
      } else {
        console.log(`Order saved: ${order.id} (${userId ? 'user: ' + userId : 'guest: ' + guestEmail})`);

        // Track discount code usage if a discount was applied
        const discountCode = session.metadata?.discount_code;
        if (discountCode && discountCode.length > 0) {
          try {
            const { data: codeData } = await supabase
              .from('discount_codes')
              .select('id, current_uses')
              .eq('code', discountCode.toUpperCase())
              .single();

            if (codeData) {
              await supabase
                .from('discount_code_uses')
                .insert({
                  code_id: codeData.id,
                  user_id: userId || null,
                  order_id: order.id,
                  discount_amount: parseInt(session.metadata?.discount_amount || '0'),
                });

              await supabase
                .from('discount_codes')
                .update({ current_uses: (codeData.current_uses || 0) + 1 })
                .eq('id', codeData.id);

              console.log(`✅ Discount code usage tracked: ${discountCode}`);
            }
          } catch (discountTrackError) {
            console.error('⚠️ Error tracking discount usage:', discountTrackError);
          }
        }

        // Decrement stock for each item in the order
        try {
          console.log(`Starting stock decrement for ${cartItems.length} items...`);
          for (const item of cartItems) {
            const productId = item.id;
            const quantity = item.qty || 1;
            const size = item.size;

            console.log(`\n  Processing item: ${productId} (qty: ${quantity}, size: ${size})`);

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

            let newSizesAvailable = product.sizes_available || {};
            if (newSizesAvailable && typeof newSizesAvailable === 'object' && size) {
              if (newSizesAvailable[size]) {
                newSizesAvailable[size] = Math.max(0, (newSizesAvailable[size] || 0) - quantity);
              }
            }

            const newStock = Object.values(newSizesAvailable).reduce((sum: number, qty: any) => sum + (parseInt(qty) || 0), 0);

            console.log(`    Size ${size}: Decremented by ${quantity}, new quantity: ${newSizesAvailable[size] || 0}`);
            console.log(`    New total stock: ${product.stock} -> ${newStock}`);

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
          const emailRecipient = session.customer_email || guestEmail;
          if (order && emailRecipient) {
            const customerName = (session as any).shipping?.name || 'Cliente';
            
            let shippingAddress = undefined;
            if ((session as any).shipping?.address) {
              shippingAddress = (session as any).shipping.address;
            }

            const subtotal = cartItems.reduce(
              (sum: number, item: any) => sum + (item.price || 0) * (item.qty || item.quantity || 1),
              0
            );
            const tax = total - subtotal;

            let invoicePDF: Buffer | undefined = undefined;
            try {
              invoicePDF = await generateInvoicePDF({
                invoiceNumber: session.id.slice(-8).toUpperCase(),
                date: new Date().toLocaleDateString('es-ES'),
                customerName,
                customerEmail: emailRecipient,
                customerPhone: (session.customer_details as any)?.phone,
                shippingAddress,
                items: cartItems.map((item: any) => ({
                  name: item.product?.name || item.name || 'Producto',
                  quantity: item.quantity || item.qty || 1,
                  price: item.price || 0,
                  size: item.size,
                  image: item.img || item.image || '',
                })),
                subtotal,
                tax,
                total,
                orderStatus: 'Completado',
              });
              console.log(`✅ Invoice PDF generated for order ${order.id}`);
            } catch (pdfError) {
              console.error(`⚠️ Failed to generate invoice PDF (will not block):`, pdfError);
            }

            const orderDetails = {
              orderId: order.id,
              email: emailRecipient,
              customerName,
              items: cartItems.map((item: any) => ({
                id: item.id || '',
                name: item.product?.name || item.name || 'Producto',
                price: item.price || 0,
                quantity: item.quantity || item.qty || 1,
                image: item.img || item.image || '',
                size: item.size,
              })),
              subtotal,
              tax,
              total,
              shippingAddress,
              stripeSessionId: session.id,
              invoicePDF,
            };

            try {
              await sendOrderConfirmationEmail(orderDetails);
              console.log(`✅ Order confirmation email sent to ${emailRecipient}`);
            } catch (confirmError) {
              console.error(`⚠️ Failed to send confirmation (will not block):`, confirmError);
            }

            try {
              await sendAdminOrderNotification(orderDetails);
              console.log(`✅ Admin notification email sent`);
            } catch (adminEmailError) {
              console.error('⚠️ Failed to send admin notification (will not block):', adminEmailError);
            }
          }
        } catch (emailError) {
          console.error('Error sending order confirmation email:', emailError);
        }
      }
    }

    // Handle payment_intent.payment_failed event
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('Payment failed:', paymentIntent.id);
      
      const supabase = getSupabaseServiceClient();
      const failedUserId = paymentIntent.metadata?.user_id || null;
      
      await supabase
        .from('orders')
        .insert({
          user_id: failedUserId || null,
          stripe_payment_intent_id: paymentIntent.id,
          status: 'failed',
          total_amount: paymentIntent.amount || 0,
          items: (() => {
            try {
              if (paymentIntent.metadata?.cart_items) return JSON.parse(paymentIntent.metadata.cart_items);
              if (paymentIntent.metadata?.cart_items_chunks) {
                const cnt = parseInt(paymentIntent.metadata.cart_items_chunks);
                let raw = '';
                for (let i = 0; i < cnt; i++) raw += paymentIntent.metadata[`cart_items_${i}`] || '';
                return JSON.parse(raw);
              }
              return [];
            } catch { return []; }
          })(),
          billing_email: paymentIntent.metadata?.guest_email || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
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
