import type { APIRoute } from 'astro';
import { supabase, getSupabaseServiceClient } from '@lib/supabase';
import { stripe } from '@lib/stripe';
import { sendCancellationWithInvoiceEmail } from '@lib/email';
import { generateCancellationInvoicePDF } from '@lib/invoice';
import { enrichOrderItems } from '@lib/utils';

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

    // Estados válidos: paid, shipped, cancelled, processing
    const validStatuses = ['paid', 'processing', 'shipped', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ error: `Estado inválido. Estados válidos: ${validStatuses.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = getSupabaseServiceClient();

    // Obtener el pedido actual para verificar estado y datos de Stripe
    const { data: currentOrder, error: fetchError } = await serviceClient
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

    // Si se está cancelando, procesar reembolso automáticamente + email + factura
    let refundResult = null;
    if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
      const paymentIntentId = currentOrder.stripe_payment_intent_id;

      // 1. Procesar reembolso en Stripe
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
          refundResult = {
            error: refundError.message,
            status: 'failed',
          };
        }
      }

      // 2. Restaurar stock de los items del pedido cancelado
      const rawItems = typeof currentOrder.items === 'string'
        ? JSON.parse(currentOrder.items)
        : (currentOrder.items || []);

      // Enrich items from DB (may be in compact format)
      const items = await enrichOrderItems(serviceClient, rawItems);

      for (const item of items) {
        const productId = item.id || item.product_id;
        const quantity = item.qty || item.quantity || 1;
        const size = item.size;

        if (productId && size) {
          try {
            const { data: product } = await serviceClient
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

              await serviceClient
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

      // 3. Generar factura de cancelación y enviar email al cliente
      const customerEmail = currentOrder.billing_email;
      if (customerEmail) {
        try {
          const subtotal = items.reduce((sum: number, item: any) => sum + (item.price ?? item.p ?? 0) * (item.qty || item.quantity || 1), 0);
          // IVA: los precios ya incluyen IVA. Calcular base imponible e IVA.
          const baseImponible = Math.round(subtotal / 1.21);
          const iva = subtotal - baseImponible;
          const cancelReason = reason || currentOrder.cancelled_reason || 'Cancelado por administrador';

          const cancellationPDF = await generateCancellationInvoicePDF({
            invoiceNumber: `CAN-${currentOrder.stripe_session_id?.slice(-8).toUpperCase() || currentOrder.id.slice(0, 8).toUpperCase()}`,
            date: new Date().toLocaleDateString('es-ES'),
            customerName: currentOrder.shipping_name || 'Cliente',
            customerEmail: customerEmail,
            customerPhone: currentOrder.shipping_phone,
            shippingAddress: currentOrder.shipping_address ? (typeof currentOrder.shipping_address === 'string' ? JSON.parse(currentOrder.shipping_address) : currentOrder.shipping_address) : undefined,
            items: items.map((item: any) => ({
              name: item.name || item.n || 'Producto',
              quantity: item.qty || item.quantity || 1,
              price: item.price ?? item.p ?? 0,
              size: item.size || item.s || '',
              image: item.img || item.image || '',
            })),
            subtotal: baseImponible,
            tax: iva,
            total: currentOrder.total_amount || subtotal,
            cancellationReason: cancelReason,
            refundAmount: refundResult?.amount || currentOrder.total_amount || 0,
            refundStatus: refundResult?.status || 'pending',
            originalOrderDate: new Date(currentOrder.created_at).toLocaleDateString('es-ES'),
          });

          await sendCancellationWithInvoiceEmail({
            orderId: currentOrder.id,
            email: customerEmail,
            customerName: currentOrder.shipping_name || 'Cliente',
            reason: cancelReason,
            refundAmount: refundResult?.amount || currentOrder.total_amount || 0,
            items: items,
            total: currentOrder.total_amount || 0,
            invoicePDF: cancellationPDF,
          });

          console.log(`✅ Email de cancelación con factura enviado a ${customerEmail}`);
        } catch (emailError) {
          console.error('⚠️ Error enviando email de cancelación:', emailError);
        }
      }
    }

    // Preparar datos de actualización
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_reason = reason || currentOrder.cancelled_reason || 'Cancelado por administrador';
    }
    if (status === 'shipped') {
      updateData.shipped_at = new Date().toISOString();
    }

    const { data, error } = await serviceClient
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
