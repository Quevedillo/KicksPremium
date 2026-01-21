import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import { generateInvoicePDF, generateInvoiceFilename } from '@lib/invoice';

export const GET: APIRoute = async ({ request, params }) => {
  try {
    // Obtener acceso token de cookies
    const authHeader = request.headers.get('cookie');
    let userId = null;

    if (authHeader) {
      const accessToken = authHeader.match(/sb-access-token=([^;]+)/)?.[1];
      const refreshToken = authHeader.match(/sb-refresh-token=([^;]+)/)?.[1];

      if (accessToken && refreshToken) {
        const { data: sessionData } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        userId = sessionData?.user?.id || null;
      }
    }

    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Obtener ID del pedido
    const orderId = new URL(request.url).searchParams.get('id');
    if (!orderId) {
      return new Response('Order ID required', { status: 400 });
    }

    // Obtener pedido de la base de datos
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', userId)
      .single();

    if (error || !order) {
      console.error('Error fetching order:', error);
      return new Response('Order not found', { status: 404 });
    }

    // Preparar datos para factura
    const items = Array.isArray(order.items) ? order.items : [];
    const shippingAddress = order.shipping_address ? (typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address) : undefined;

    const invoiceData = {
      invoiceNumber: `${order.stripe_session_id?.slice(-8).toUpperCase() || order.id.slice(0, 8).toUpperCase()}`,
      date: new Date(order.created_at).toLocaleDateString('es-ES'),
      customerName: order.shipping_name || 'Cliente',
      customerEmail: order.billing_email || '',
      customerPhone: order.shipping_phone,
      shippingAddress,
      items: items.map((item: any) => ({
        name: item.product?.name || item.name || 'Producto',
        quantity: item.quantity || item.qty || 1,
        price: item.price || 0,
        size: item.size,
      })),
      subtotal: items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || item.qty || 1), 0),
      tax: 0, // Se calcula del total
      discount: order.discount_amount || 0,
      total: order.total_price || order.total_amount || 0,
      orderStatus: order.status === 'completed' ? 'Completado' : order.status === 'pending' ? 'Pendiente' : order.status === 'paid' ? 'Pagado' : order.status,
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
