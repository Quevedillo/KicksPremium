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

    console.log(`🔄 Iniciando sincronización de pedidos de Stripe (límite: ${limit})...`);

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

        // Create order in Supabase
        const { error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: userId,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            total_amount: (session.amount_total || 0) / 100,
            status: 'completed',
            shipping_name: session.shipping_details?.name || null,
            shipping_address: session.shipping_details?.address || null,
            shipping_phone: session.customer_details?.phone || null,
            billing_email: session.customer_email || null,
            items: cartItems,
            created_at: session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (orderError) {
          errors.push(`Error saving order ${session.id}: ${orderError.message}`);
          console.error(`❌ Error guardando pedido ${session.id}:`, orderError);
        } else {
          syncedCount++;
          console.log(`✅ Pedido sincronizado: ${session.id} (usuario: ${userId})`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        errors.push(`Error processing session ${session.id}: ${errorMsg}`);
        console.error(`❌ Error procesando sesión ${session.id}:`, error);
      }
    }

    const message = `✅ Sincronización completada: ${syncedCount} pedidos sincronizados, ${skippedCount} omitidos`;
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
    console.error('❌ Error en sincronización:', error);

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
