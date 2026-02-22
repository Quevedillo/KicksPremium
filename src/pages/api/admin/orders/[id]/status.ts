import type { APIRoute } from 'astro';
import { supabase, getSupabaseServiceClient } from '@lib/supabase';
import { stripe } from '@lib/stripe';
import { sendCancellationWithInvoiceEmail } from '@lib/email';
import { generateCancellationInvoicePDF } from '@lib/invoice';
import { enrichOrderItems } from '@lib/utils';
import type { NormalizedOrderItem } from '@lib/types';

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

    // Estados válidos: paid, processing, shipped, delivered, cancelled
    const validStatuses = ['paid', 'processing', 'shipped', 'delivered', 'cancelled'];
    
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
          console.log(`Reembolso procesado: ${refund.id} - ${refund.amount / 100}€`);
        } catch (refundError: unknown) {
          const errMsg = refundError instanceof Error ? refundError.message : String(refundError);
          console.error('Error procesando reembolso:', errMsg);
          refundResult = {
            error: errMsg,
            status: 'failed',
          };
        }
      }

      // 2. Restaurar stock usando RPC atómico (add_size_stock)
      const rawItems = typeof currentOrder.items === 'string'
        ? JSON.parse(currentOrder.items)
        : (currentOrder.items || []);

      // Enrich items from DB (may be in compact format)
      const items = await enrichOrderItems(serviceClient, rawItems);

      for (const item of items) {
        const productId = item.id;
        const quantity = item.qty || 1;
        const size = item.size;

        if (productId && size) {
          try {
            const { data: rpcResult, error: rpcError } = await serviceClient
              .rpc('add_size_stock', {
                p_product_id: productId,
                p_size: size,
                p_quantity: quantity,
              });

            if (rpcError) {
              console.error(`RPC error restaurando stock de ${productId}:`, rpcError);
            } else if (rpcResult && !rpcResult.success) {
              console.error(`Error restaurando stock: ${rpcResult.error}`);
            } else {
              console.log(`Stock restaurado atómicamente: ${productId} talla ${size} +${quantity}`);
            }
          } catch (stockError) {
            console.error(`Error restaurando stock de ${productId}:`, stockError);
          }
        }
      }

      // 3. Generar factura rectificativa y enviar email al cliente
      const customerEmail = currentOrder.billing_email;
      if (customerEmail) {
        try {
          const subtotal = items.reduce((sum: number, item: NormalizedOrderItem) => sum + (item.price ?? 0) * (item.qty || 1), 0);
          // IVA: los precios ya incluyen IVA. Calcular base imponible e IVA.
          const baseImponible = Math.round(subtotal / 1.21);
          const iva = subtotal - baseImponible;
          const cancelReason = reason || currentOrder.cancelled_reason || 'Cancelado por administrador';

          // Buscar factura original y crear rectificativa
          const { data: originalInvoice } = await serviceClient
            .from('invoices')
            .select('id, invoice_number')
            .eq('order_id', currentOrder.id)
            .eq('type', 'standard')
            .single();

          let rectInvoiceNum = '';
          try {
            const { data: invNumData } = await serviceClient.rpc('generate_invoice_number', { invoice_type: 'rectificativa' });
            rectInvoiceNum = invNumData || `R-${Date.now()}`;
            await serviceClient.from('invoices').insert({
              invoice_number: rectInvoiceNum,
              order_id: currentOrder.id,
              type: 'rectificativa',
              original_invoice_id: originalInvoice?.id || null,
              amount: -(refundResult?.amount || currentOrder.total_amount || 0),
              customer_email: customerEmail,
            });
            console.log(`Rectificativa invoice: ${rectInvoiceNum}`);
          } catch (invErr) {
            console.error('Error creating rectificativa:', invErr);
            rectInvoiceNum = `R-${currentOrder.id.slice(0, 8).toUpperCase()}`;
          }

          const cancellationPDF = await generateCancellationInvoicePDF({
            invoiceNumber: rectInvoiceNum,
            date: new Date().toLocaleDateString('es-ES'),
            customerName: currentOrder.shipping_name || 'Cliente',
            customerEmail: customerEmail,
            customerPhone: currentOrder.shipping_phone,
            shippingAddress: currentOrder.shipping_address ? (typeof currentOrder.shipping_address === 'string' ? JSON.parse(currentOrder.shipping_address) : currentOrder.shipping_address) : undefined,
            items: items.map((item: NormalizedOrderItem) => ({
              name: item.name || 'Producto',
              quantity: item.qty || 1,
              price: item.price ?? 0,
              size: item.size || '',
              image: item.img || '',
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

          console.log(`Email de cancelación con factura enviado a ${customerEmail}`);
        } catch (emailError) {
          console.error('Error enviando email de cancelación:', emailError);
        }
      }
    }

    // Preparar datos de actualización
    const updateData: Record<string, string> = { status, updated_at: new Date().toISOString() };
    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_reason = reason || currentOrder.cancelled_reason || 'Cancelado por administrador';
    }
    if (status === 'shipped') {
      updateData.shipped_at = new Date().toISOString();
    }
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
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
