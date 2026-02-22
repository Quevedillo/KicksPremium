import type { APIRoute } from 'astro';
import { supabase, getSupabaseServiceClient } from '@lib/supabase';
import { generateInvoicePDF, generateInvoiceFilename } from '@lib/invoice';
import { enrichOrderItems } from '@lib/utils';
import type { NormalizedOrderItem } from '@lib/types';

export const GET: APIRoute = async ({ request, params }) => {
  try {
    // Obtener acceso token de cookies
    const authHeader = request.headers.get('cookie');
    let userId = null;
    let userEmail = null;

    if (authHeader) {
      const accessToken = authHeader.match(/sb-access-token=([^;]+)/)?.[1];
      const refreshToken = authHeader.match(/sb-refresh-token=([^;]+)/)?.[1];

      if (accessToken && refreshToken) {
        const { data: sessionData } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        userId = sessionData?.user?.id || null;
        userEmail = sessionData?.user?.email || null;
      }
    }

    // Obtener ID del pedido y email de guest (para acceso sin sesión)
    const url = new URL(request.url);
    const orderId = url.searchParams.get('id');
    const guestEmail = url.searchParams.get('email');

    if (!orderId) {
      return new Response('Order ID required', { status: 400 });
    }

    let order: Record<string, unknown> | null = null;
    const serviceClient = getSupabaseServiceClient();

    if (userId) {
      // Usuario autenticado: buscar por user_id o billing_email
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .or(`user_id.eq.${userId},billing_email.eq.${userEmail}`)
        .single();

      if (error || !data) {
        console.error('Error fetching order:', error);
        return new Response('Order not found', { status: 404 });
      }
      order = data;
    } else if (guestEmail && guestEmail.includes('@')) {
      // Guest: buscar por billing_email usando service client (bypass RLS)
      const { data, error } = await serviceClient
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('billing_email', guestEmail)
        .single();

      if (error || !data) {
        console.error('Error fetching guest order:', error);
        return new Response('Order not found', { status: 404 });
      }
      order = data;
    } else {
      return new Response('Unauthorized', { status: 401 });
    }

    // Preparar datos para factura
    const items = Array.isArray(order.items) ? order.items : [];
    const shippingAddress = order.shipping_address ? (typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address) : undefined;

    // Enrich items from DB (in case stored in compact format without name/brand/image)
    const enrichedItems = await enrichOrderItems(serviceClient, items);

    // Normalizar items para la factura
    const normalizedItems = enrichedItems.map((item: NormalizedOrderItem) => ({
      name: item.name || 'Producto',
      quantity: item.qty || 1,
      price: item.price ?? 0,
      size: item.size || '',
      image: item.img || '',
    }));

    const subtotal = normalizedItems.reduce((sum: number, item: { price: number; quantity: number }) => sum + (item.price || 0) * (item.quantity || 1), 0);

    // IVA: los precios ya incluyen IVA. Calcular base imponible e IVA desde el total.
    const baseImponible = Math.round(subtotal / 1.21);
    const iva = subtotal - baseImponible;

    // Buscar número de factura secuencial en la tabla invoices
    const { data: invoiceRecord } = await serviceClient
      .from('invoices')
      .select('invoice_number')
      .eq('order_id', orderId)
      .eq('type', 'standard')
      .single();

    const invoiceData = {
      invoiceNumber: invoiceRecord?.invoice_number || `${order.stripe_session_id?.slice(-8).toUpperCase() || order.id.slice(0, 8).toUpperCase()}`,
      date: new Date(order.created_at).toLocaleDateString('es-ES'),
      customerName: order.shipping_name || 'Cliente',
      customerEmail: order.billing_email || '',
      customerPhone: order.shipping_phone,
      shippingAddress,
      items: normalizedItems,
      subtotal: baseImponible,
      tax: iva,
      discount: order.discount_amount || 0,
      total: order.total_amount || subtotal,
      orderStatus: (order.status === 'paid' || order.status === 'completed') ? 'Pagado' : order.status === 'shipped' ? 'Enviado' : order.status === 'cancelled' ? 'Cancelado' : order.status === 'processing' ? 'Procesando' : order.status,
    };

    // Generar PDF
    const pdfBuffer = await generateInvoicePDF(invoiceData);

    // Retornar PDF como descarga
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${generateInvoiceFilename(invoiceData.invoiceNumber)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return new Response('Error generating invoice', { status: 500 });
  }
};
