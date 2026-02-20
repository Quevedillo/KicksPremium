import type { APIRoute } from 'astro';
import { stripe } from '@lib/stripe';
import { supabase } from '@lib/supabase';
import Stripe from 'stripe';

/**
 * API endpoint para sincronizar pedidos existentes de Stripe con la base de datos
 * Útil cuando hay pedidos en Stripe que no se han sincronizado aún
 * 
 * Uso: POST /api/sync/stripe-orders
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { limit = 100 } = body;

    console.log(`Iniciando sincronización de pedidos de Stripe (límite: ${limit})...`);

    // Get completed sessions from Stripe
    const sessions = await stripe.checkout.sessions.list({
      limit,
      expand: ['data.line_items'],
    });

    let syncedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const session of sessions.data) {
      try {
        // Skip if no user metadata
        if (!session.metadata?.user_id) {
          skippedCount++;
          continue;
        }

        const userId = session.metadata.user_id;

        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('stripe_session_id', session.id)
          .single();

        if (existingOrder) {
          skippedCount++;
          continue;
        }

        // Parse cart items
        const cartItems = JSON.parse(session.metadata.cart_items || '[]');

        // Get the full session with line items to ensure we have the total
        let total = session.amount_total || 0;
        
        if (total === 0 && session.id) {
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

        // Create order in Supabase
        const { error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: userId,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            total_amount: total, // Keep in cents (integer)
            status: 'paid',
            shipping_name: (session as any).shipping?.name || null,
            shipping_address: JSON.stringify((session as any).shipping?.address) || null,
            shipping_phone: session.customer_details?.phone || null,
            billing_email: session.customer_email || null,
            items: cartItems,
            created_at: session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (orderError) {
          errors.push(`Error saving order ${session.id}: ${orderError.message}`);
          console.error(`Error guardando pedido ${session.id}:`, orderError);
        } else {
          syncedCount++;
          console.log(`Pedido sincronizado: ${session.id} (usuario: ${userId})`);

          // Decrement stock for each item in the order
          try {
            for (const item of cartItems) {
              const productId = item.id;
              const quantity = item.qty || 1;
              const size = item.size;

              // Get current product
              const { data: product, error: fetchError } = await supabase
                .from('products')
                .select('stock, sizes_available')
                .eq('id', productId)
                .single();

              if (fetchError || !product) {
                console.error(`Error fetching product ${productId}:`, fetchError);
                continue;
              }

              // Decrement total stock
              const newStock = Math.max(0, (product.stock || 0) - quantity);

              // Update sizes_available if it exists
              let newSizesAvailable = product.sizes_available || {};
              if (newSizesAvailable && typeof newSizesAvailable === 'object' && size) {
                if (newSizesAvailable[size]) {
                  newSizesAvailable[size] = Math.max(0, (newSizesAvailable[size] || 0) - quantity);
                }
              }

              // Update product stock
              const { error: updateError } = await supabase
                .from('products')
                .update({
                  stock: newStock,
                  sizes_available: newSizesAvailable,
                })
                .eq('id', productId);

              if (updateError) {
                console.error(`Error updating stock for product ${productId}:`, updateError);
              } else {
                console.log(`Stock updated for product ${productId}: ${quantity} -> ${newStock} remaining`);
              }
            }
          } catch (error) {
            console.error('Error decrementing stock during sync:', error);
            // Don't fail the sync if stock update fails
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        errors.push(`Error processing session ${session.id}: ${errorMsg}`);
        console.error(`Error procesando sesión ${session.id}:`, error);
      }
    }

    const message = `Sincronización completada: ${syncedCount} pedidos sincronizados, ${skippedCount} omitidos`;
    console.log(message);

    return new Response(
      JSON.stringify({
        success: true,
        message,
        synced: syncedCount,
        skipped: skippedCount,
        errors,
        totalProcessed: sessions.data.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en sincronización:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
