import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Helper para caracteres especiales en pdf-lib (no soporta UTF-8 completo)
function sanitizeText(text: string): string {
  return text
    .replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i')
    .replace(/[óò]/g, 'o').replace(/[úù]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[ÁÀ]/g, 'A').replace(/[ÉÈ]/g, 'E').replace(/[ÍÌ]/g, 'I')
    .replace(/[ÓÒ]/g, 'O').replace(/[ÚÙ]/g, 'U').replace(/Ñ/g, 'N')
    .replace(/[^\x20-\x7E]/g, '');
}

export const GET: APIRoute = async (context) => {
  try {
    const { id } = context.params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Order ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener el pedido
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parsear items
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
    
    // Parsear shipping_address si es string
    if (order.shipping_address && typeof order.shipping_address === 'string') {
      try { order.shipping_address = JSON.parse(order.shipping_address); } catch {}
    }

    // Crear documento PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();
    
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;

    // Encabezado
    page.drawText('KICKSPREMIUM', {
      x: 50,
      y: y,
      size: 24,
      font: helveticaBold,
      color: rgb(0.93, 0.26, 0.26)
    });

    page.drawText('Factura', {
      x: width - 150,
      y: y,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });

    y -= 40;

    // Información del pedido
    page.drawText(sanitizeText(`Numero de Pedido: #${order.id.slice(0, 8).toUpperCase()}`), {
      x: 50,
      y: y,
      size: 10,
      font: helvetica
    });

    y -= 20;
    const createdDate = new Date(order.created_at).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    page.drawText(sanitizeText(`Fecha: ${createdDate}`), {
      x: 50,
      y: y,
      size: 10,
      font: helvetica
    });

    y -= 20;
    page.drawText(`Estado: ${order.status.toUpperCase()}`, {
      x: 50,
      y: y,
      size: 10,
      font: helvetica
    });

    y -= 40;

    // Informacion del cliente
    page.drawText('CLIENTE', {
      x: 50,
      y: y,
      size: 11,
      font: helveticaBold
    });

    y -= 20;
    page.drawText(order.shipping_name || 'N/A', {
      x: 50,
      y: y,
      size: 10,
      font: helvetica
    });

    y -= 15;
    page.drawText(order.billing_email || 'N/A', {
      x: 50,
      y: y,
      size: 10,
      font: helvetica
    });

    if (order.shipping_phone) {
      y -= 15;
      page.drawText(order.shipping_phone, {
        x: 50,
        y: y,
        size: 10,
        font: helvetica
      });
    }

    y -= 30;

    // Direccion de envio
    page.drawText('DIRECCION DE ENVIO', {
      x: 50,
      y: y,
      size: 11,
      font: helveticaBold
    });

    y -= 20;
    if (order.shipping_address && typeof order.shipping_address === 'object') {
      if (order.shipping_address.line1) {
        page.drawText(order.shipping_address.line1, { x: 50, y: y, size: 10, font: helvetica });
        y -= 15;
      }
      if (order.shipping_address.line2) {
        page.drawText(order.shipping_address.line2, { x: 50, y: y, size: 10, font: helvetica });
        y -= 15;
      }
      if (order.shipping_address.postal_code || order.shipping_address.city) {
        page.drawText(`${order.shipping_address.postal_code || ''} ${order.shipping_address.city || ''}`, {
          x: 50,
          y: y,
          size: 10,
          font: helvetica
        });
        y -= 15;
      }
      if (order.shipping_address.country) {
        page.drawText(order.shipping_address.country, { x: 50, y: y, size: 10, font: helvetica });
        y -= 15;
      }
    }

    y -= 20;

    // Tabla de productos
    page.drawText('PRODUCTOS', {
      x: 50,
      y: y,
      size: 11,
      font: helveticaBold
    });

    y -= 25;

    // Headers de tabla
    page.drawText('Producto', { x: 50, y: y, size: 10, font: helveticaBold });
    page.drawText('Talla', { x: 280, y: y, size: 10, font: helveticaBold });
    page.drawText('Cant.', { x: 380, y: y, size: 10, font: helveticaBold });
    page.drawText('Precio', { x: 450, y: y, size: 10, font: helveticaBold });
    page.drawText('Total', { x: 520, y: y, size: 10, font: helveticaBold });

    y -= 15;
    page.drawLine({
      start: { x: 50, y: y },
      end: { x: width - 50, y: y },
      thickness: 1,
      color: rgb(0.78, 0.78, 0.78)
    });

    y -= 15;

    // Items
    items.forEach((item: any) => {
      const productName = sanitizeText(item.name || 'Producto');
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const size = item.size || '-';
      const total = price * quantity;

      page.drawText(productName.substring(0, 30), { x: 50, y: y, size: 9, font: helvetica });
      page.drawText(String(size), { x: 280, y: y, size: 9, font: helvetica });
      page.drawText(String(quantity), { x: 380, y: y, size: 9, font: helvetica });
      page.drawText(`EUR ${(price / 100).toFixed(2)}`, { x: 440, y: y, size: 9, font: helvetica });
      page.drawText(`EUR ${(total / 100).toFixed(2)}`, { x: 510, y: y, size: 9, font: helvetica });

      y -= 20;
    });

    y -= 10;
    page.drawLine({
      start: { x: 50, y: y },
      end: { x: width - 50, y: y },
      thickness: 1,
      color: rgb(0.78, 0.78, 0.78)
    });

    y -= 25;

    // Totales
    const subtotal = order.total_amount || order.total_price || 0;
    const discount = order.discount_amount || 0;
    const total = subtotal - discount;

    page.drawText('Subtotal:', { x: 380, y: y, size: 10, font: helvetica });
    page.drawText(`EUR ${(subtotal / 100).toFixed(2)}`, { x: 510, y: y, size: 10, font: helvetica });

    y -= 20;
    if (discount > 0) {
      page.drawText('Descuento:', { x: 380, y: y, size: 10, font: helvetica });
      page.drawText(`-EUR ${(discount / 100).toFixed(2)}`, { x: 505, y: y, size: 10, font: helvetica });
      y -= 20;
    }

    page.drawText('TOTAL:', { x: 380, y: y, size: 12, font: helveticaBold });
    page.drawText(`EUR ${(total / 100).toFixed(2)}`, { x: 505, y: y, size: 12, font: helveticaBold });

    y -= 40;

    // Pie de pagina
    page.drawText('Gracias por tu compra en KicksPremium', {
      x: 50,
      y: 40,
      size: 9,
      font: helvetica,
      color: rgb(0.59, 0.59, 0.59)
    });

    page.drawText('Para consultas, contactanos a support@kickspremium.com', {
      x: 50,
      y: 25,
      size: 8,
      font: helvetica,
      color: rgb(0.59, 0.59, 0.59)
    });

    // Generar PDF
    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura-${order.id.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return new Response(
      JSON.stringify({ error: 'Error generando la factura' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
