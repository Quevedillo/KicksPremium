import type { APIRoute } from 'astro';
import { supabase, getSupabaseServiceClient } from '@lib/supabase';
import { stripe } from '@lib/stripe';
import { sendCancellationWithInvoiceEmail, sendAdminCancellationRequestEmail } from '@lib/email';
import { generateCancellationInvoicePDF } from '@lib/invoice';
import { enrichOrderItems } from '@lib/utils';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedOrderItem } from '@lib/types';

// Helper: restaurar stock de los items de un pedido usando RPC atómico
async function restoreOrderStock(serviceClient: SupabaseClient, items: NormalizedOrderItem[]) {
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
          console.error(`⚠️ RPC error restaurando stock de ${productId}:`, rpcError);
        } else if (rpcResult && !rpcResult.success) {
          console.error(`⚠️ Error restaurando stock: ${rpcResult.error}`);
        } else {
          console.log(`✅ Stock restaurado atómicamente: ${productId} talla ${size} +${quantity}`);
        }
      } catch (stockError) {
        console.error(`⚠️ Error restaurando stock de ${productId}:`, stockError);
      }
    }
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { orderId, reason } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID de pedido requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener usuario autenticado
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError || !sessionData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sesión inválida' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = sessionData.user.id;
    const userEmail = sessionData.user.email || '';
    const serviceClient = getSupabaseServiceClient();

    // Obtener el pedido actual
    const { data: order, error: fetchError } = await serviceClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cancelReason = reason || 'Cancelado por el cliente';
    const rawItems = typeof order.items === 'string' ? JSON.parse(order.items) : (Array.isArray(order.items) ? order.items : []);

    // Enrich items from DB (may be in compact format without name/brand/image)
    const items = await enrichOrderItems(serviceClient, rawItems);

    // ========================================
    // CASO 1: Pedido PAGADO (o 'completed' legacy) → Cancelación directa + reembolso
    // ========================================
    if (order.status === 'paid' || order.status === 'completed') {
      // 1. Restaurar stock directamente (sin depender de RPC)
      await restoreOrderStock(serviceClient, items);

      // 2. Marcar pedido como cancelado
      const { error: updateError } = await serviceClient
        .from('orders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_reason: cancelReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error actualizando pedido:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al cancelar el pedido' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 3. Procesar reembolso en Stripe
      let refundResult: { refundId?: string; amount?: number; status: string; error?: string } | null = null;
      const paymentIntentId = order.stripe_payment_intent_id;

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
        } catch (refundError: unknown) {
          const errMsg = refundError instanceof Error ? refundError.message : String(refundError);
          console.error('⚠️ Error procesando reembolso:', errMsg);
          refundResult = { error: errMsg, status: 'failed' };
        }
      }

      // 4. Generar factura rectificativa con numeración secuencial
      try {
        const subtotal = items.reduce((sum: number, item: NormalizedOrderItem) => sum + (item.price || 0) * (item.qty || 1), 0);
        // IVA: los precios ya incluyen IVA. Calcular base imponible e IVA.
        const baseImponible = Math.round(subtotal / 1.21);
        const iva = subtotal - baseImponible;

        // Buscar factura original para vincularla
        const { data: originalInvoice } = await serviceClient
          .from('invoices')
          .select('id, invoice_number')
          .eq('order_id', order.id)
          .eq('type', 'standard')
          .single();

        // Generar número secuencial para rectificativa
        let rectInvoiceNum = '';
        try {
          const { data: invNumData } = await serviceClient.rpc('generate_invoice_number', { invoice_type: 'rectificativa' });
          rectInvoiceNum = invNumData || `R-${Date.now()}`;
          await serviceClient.from('invoices').insert({
            invoice_number: rectInvoiceNum,
            order_id: order.id,
            type: 'rectificativa',
            original_invoice_id: originalInvoice?.id || null,
            amount: -(refundResult?.amount || order.total_amount || 0),
            customer_email: userEmail || order.billing_email || null,
          });
          console.log(`✅ Rectificativa invoice created: ${rectInvoiceNum} (ref: ${originalInvoice?.invoice_number || 'N/A'})`);
        } catch (invErr) {
          console.error('⚠️ Error creating rectificativa invoice:', invErr);
          rectInvoiceNum = `R-${order.id.slice(0, 8).toUpperCase()}`;
        }

        const cancellationPDF = await generateCancellationInvoicePDF({
          invoiceNumber: rectInvoiceNum,
          date: new Date().toLocaleDateString('es-ES'),
          customerName: order.shipping_name || 'Cliente',
          customerEmail: userEmail || order.billing_email || '',
          customerPhone: order.shipping_phone,
          shippingAddress: order.shipping_address ? (typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address) : undefined,
          items: items.map((item: NormalizedOrderItem) => ({
            name: item.name || 'Producto',
            quantity: item.qty || 1,
            price: item.price || 0,
            size: item.size,
            image: item.img || '',
          })),
          subtotal: baseImponible,
          tax: iva,
          total: order.total_amount || subtotal,
          cancellationReason: cancelReason,
          refundAmount: refundResult?.amount || order.total_amount || 0,
          refundStatus: refundResult?.status || 'pending',
          originalOrderDate: new Date(order.created_at).toLocaleDateString('es-ES'),
        });

        await sendCancellationWithInvoiceEmail({
          orderId: order.id,
          email: userEmail || order.billing_email || '',
          customerName: order.shipping_name || 'Cliente',
          reason: cancelReason,
          refundAmount: refundResult?.amount || order.total_amount || 0,
          items: items,
          total: order.total_amount || 0,
          invoicePDF: cancellationPDF,
        });
      } catch (emailError) {
        console.error('Error enviando email de cancelación:', emailError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'cancelled',
          message: 'Pedido cancelado. El reembolso se ha procesado.',
          refund: refundResult,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // CASO 2: Pedido ENVIADO → Solicitud de cancelación (pendiente admin)
    // ========================================
    if (order.status === 'shipped') {
      // Marcar como processing (pendiente admin), NO restaurar stock aún
      const { error: updateError } = await serviceClient
        .from('orders')
        .update({
          status: 'processing',
          cancelled_reason: cancelReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error actualizando pedido:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al solicitar la cancelación' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Notificar al admin
      try {
        await sendAdminCancellationRequestEmail({
          orderId: order.id,
          customerName: order.shipping_name || 'Cliente',
          customerEmail: userEmail || order.billing_email || '',
          reason: cancelReason,
          total: order.total_amount || 0,
        });
      } catch (emailError) {
        console.error('Error enviando notificación al admin:', emailError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'pending_admin',
          message: 'Tu solicitud de cancelación ha sido enviada. Un administrador la revisará.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // Otros estados: no se puede cancelar
    // ========================================
    return new Response(
      JSON.stringify({
        success: false,
        error: `No se puede cancelar un pedido con estado "${order.status}". Solo se pueden cancelar pedidos pagados o enviados.`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in order cancellation:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
