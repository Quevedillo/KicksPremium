import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import { stripe } from '@lib/stripe';

export const POST: APIRoute = async ({ params, request, cookies }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar autenticación
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar si es admin
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'No tienes permisos de administrador' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { status, reason } = body;

    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener el pedido actual para verificar estado y datos de Stripe
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentOrder) {
      return new Response(
        JSON.stringify({ error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Si se está cancelando, procesar reembolso automáticamente
    let refundResult = null;
    if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
      const paymentIntentId = currentOrder.stripe_payment_intent_id;

      if (paymentIntentId && typeof paymentIntentId === 'string') {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: 'requested_by_customer',
          });
          refundResult = {
            refundId: refund.id,
            amount: refund.amount,
            status: refund.status,
          };
          console.log(`✅ Reembolso procesado: ${refund.id} - ${refund.amount / 100}€`);
        } catch (refundError: any) {
          console.error('⚠️ Error procesando reembolso:', refundError.message);
          // Si el reembolso falla (ej: ya reembolsado), seguir con la cancelación
          refundResult = {
            error: refundError.message,
            status: 'failed',
          };
        }
      }

      // Restaurar stock de los items del pedido cancelado
      const items = typeof currentOrder.items === 'string'
        ? JSON.parse(currentOrder.items)
        : (currentOrder.items || []);

      for (const item of items) {
        const productId = item.id || item.product_id;
        const quantity = item.qty || item.quantity || 1;
        const size = item.size;

        if (productId && size) {
          try {
            const { data: product } = await supabase
              .from('products')
              .select('sizes_available, stock')
              .eq('id', productId)
              .single();

            if (product) {
              const sizesAvailable = product.sizes_available || {};
              sizesAvailable[size] = (parseInt(sizesAvailable[size]) || 0) + quantity;
              const newStock = Object.values(sizesAvailable).reduce(
                (sum: number, qty: any) => sum + (parseInt(String(qty)) || 0), 0
              );

              await supabase
                .from('products')
                .update({ sizes_available: sizesAvailable, stock: newStock })
                .eq('id', productId);

              console.log(`✅ Stock restaurado: ${productId} talla ${size} +${quantity}`);
            }
          } catch (stockError) {
            console.error(`⚠️ Error restaurando stock de ${productId}:`, stockError);
          }
        }
      }
    }

    // Preparar datos de actualización
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_reason = reason || 'Cancelado por administrador';
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating order status:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update order status' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, order: data, refund: refundResult }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
