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

// Helper para obtener nombre país
function getCountryName(code: string): string {
  const countries: Record<string, string> = {
    ES: 'Espana', FR: 'Francia', DE: 'Alemania', IT: 'Italia',
    PT: 'Portugal', GB: 'Reino Unido', US: 'Estados Unidos',
    MX: 'Mexico', AR: 'Argentina', CO: 'Colombia', CL: 'Chile',
  };
  return countries[code] || code;
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
    let shippingAddress = order.shipping_address;
    if (shippingAddress && typeof shippingAddress === 'string') {
      try { shippingAddress = JSON.parse(shippingAddress); } catch {}
    }

    // Crear documento PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();
    
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colores de marca
    const brandRed = rgb(0.93, 0.19, 0.19);
    const brandBlack = rgb(0.1, 0.1, 0.1);
    const grayLight = rgb(0.95, 0.95, 0.95);
    const grayMedium = rgb(0.6, 0.6, 0.6);
    const grayDark = rgb(0.3, 0.3, 0.3);

    let y = height - 40;

    // ===== HEADER CON BARRA ROJA =====
    page.drawRectangle({
      x: 0, y: height - 80, width: width, height: 80,
      color: brandBlack,
    });
    
    // Línea roja decorativa
    page.drawRectangle({
      x: 0, y: height - 84, width: width, height: 4,
      color: brandRed,
    });

    page.drawText('KICKSPREMIUM', {
      x: 50, y: height - 50, size: 22, font: helveticaBold, color: rgb(1, 1, 1)
    });
    page.drawText('AUTHENTIC SNEAKERS', {
      x: 50, y: height - 68, size: 8, font: helvetica, color: rgb(0.7, 0.7, 0.7)
    });

    page.drawText('FACTURA', {
      x: width - 140, y: height - 45, size: 18, font: helveticaBold, color: brandRed
    });
    
    const invoiceNum = order.id.slice(0, 8).toUpperCase();
    page.drawText(`#${invoiceNum}`, {
      x: width - 140, y: height - 65, size: 12, font: helveticaBold, color: rgb(1, 1, 1)
    });

    y = height - 110;

    // ===== INFORMACIÓN DEL PEDIDO (BARRA GRIS) =====
    page.drawRectangle({
      x: 40, y: y - 18, width: width - 80, height: 30,
      color: grayLight,
    });

    const createdDate = new Date(order.created_at).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    page.drawText(sanitizeText(`Fecha: ${createdDate}`), {
      x: 50, y: y - 8, size: 9, font: helvetica, color: grayDark
    });

    const statusLabels: Record<string, string> = {
      pending: 'Pendiente', paid: 'Pagado', processing: 'Procesando',
      shipped: 'Enviado', completed: 'Completado', cancelled: 'Cancelado'
    };
    page.drawText(`Estado: ${statusLabels[order.status] || order.status}`, {
      x: 250, y: y - 8, size: 9, font: helveticaBold, color: grayDark
    });

    if (order.stripe_payment_intent_id) {
      page.drawText(`Ref: ${order.stripe_payment_intent_id.slice(0, 20)}`, {
        x: 400, y: y - 8, size: 8, font: helvetica, color: grayMedium
      });
    }

    y -= 50;

    // ===== DOS COLUMNAS: CLIENTE + DIRECCIÓN =====
    // Columna izquierda: Cliente
    page.drawText('DATOS DEL CLIENTE', {
      x: 50, y: y, size: 10, font: helveticaBold, color: brandRed
    });
    y -= 5;
    page.drawLine({ start: { x: 50, y: y }, end: { x: 270, y: y }, thickness: 1, color: brandRed });
    
    y -= 18;
    page.drawText(sanitizeText(order.shipping_name || 'N/A'), {
      x: 50, y: y, size: 11, font: helveticaBold, color: brandBlack
    });
    y -= 16;
    page.drawText(order.billing_email || 'N/A', {
      x: 50, y: y, size: 9, font: helvetica, color: grayDark
    });
    if (order.shipping_phone) {
      y -= 14;
      page.drawText(sanitizeText(`Tel: ${order.shipping_phone}`), {
        x: 50, y: y, size: 9, font: helvetica, color: grayDark
      });
    }

    // Columna derecha: Dirección de envío
    let yRight = y + (order.shipping_phone ? 48 : 34);
    page.drawText('DIRECCION DE ENVIO', {
      x: 320, y: yRight, size: 10, font: helveticaBold, color: brandRed
    });
    yRight -= 5;
    page.drawLine({ start: { x: 320, y: yRight }, end: { x: width - 50, y: yRight }, thickness: 1, color: brandRed });
    
    yRight -= 18;
    if (shippingAddress && typeof shippingAddress === 'object') {
      if (shippingAddress.line1) {
        page.drawText(sanitizeText(shippingAddress.line1), { x: 320, y: yRight, size: 10, font: helvetica, color: brandBlack });
        yRight -= 14;
      }
      if (shippingAddress.line2) {
        page.drawText(sanitizeText(shippingAddress.line2), { x: 320, y: yRight, size: 10, font: helvetica, color: brandBlack });
        yRight -= 14;
      }
      if (shippingAddress.postal_code || shippingAddress.city) {
        page.drawText(sanitizeText(`${shippingAddress.postal_code || ''} ${shippingAddress.city || ''}`), {
          x: 320, y: yRight, size: 10, font: helvetica, color: brandBlack
        });
        yRight -= 14;
      }
      if (shippingAddress.state) {
        page.drawText(sanitizeText(shippingAddress.state), { x: 320, y: yRight, size: 10, font: helvetica, color: grayDark });
        yRight -= 14;
      }
      if (shippingAddress.country) {
        page.drawText(sanitizeText(getCountryName(shippingAddress.country)), { x: 320, y: yRight, size: 10, font: helvetica, color: grayDark });
      }
    } else {
      page.drawText('No disponible', { x: 320, y: yRight, size: 10, font: helvetica, color: grayMedium });
    }

    y -= 50;

    // ===== TABLA DE PRODUCTOS =====
    page.drawText('DETALLE DE PRODUCTOS', {
      x: 50, y: y, size: 10, font: helveticaBold, color: brandRed
    });
    y -= 5;
    page.drawLine({ start: { x: 50, y: y }, end: { x: width - 50, y: y }, thickness: 1, color: brandRed });

    y -= 20;

    // Headers de tabla con fondo
    page.drawRectangle({
      x: 45, y: y - 5, width: width - 90, height: 22,
      color: brandBlack,
    });

    page.drawText('Producto', { x: 55, y: y + 2, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText('Talla', { x: 300, y: y + 2, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText('Cant.', { x: 370, y: y + 2, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText('Precio', { x: 420, y: y + 2, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText('Total', { x: 500, y: y + 2, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });

    y -= 25;

    // Items con filas alternadas
    let subtotalCalc = 0;
    items.forEach((item: any, index: number) => {
      const productName = sanitizeText(item.name || 'Producto');
      const quantity = item.quantity || item.qty || 1;
      const price = item.price || 0;
      const size = item.size || '-';
      const total = price * quantity;
      subtotalCalc += total;

      // Fila alternada
      if (index % 2 === 0) {
        page.drawRectangle({
          x: 45, y: y - 6, width: width - 90, height: 22,
          color: grayLight,
        });
      }

      page.drawText(productName.substring(0, 35), { x: 55, y: y, size: 9, font: helvetica, color: brandBlack });
      page.drawText(String(size), { x: 305, y: y, size: 9, font: helvetica, color: brandBlack });
      page.drawText(String(quantity), { x: 377, y: y, size: 9, font: helveticaBold, color: brandBlack });
      page.drawText(`${(price / 100).toFixed(2)} EUR`, { x: 415, y: y, size: 9, font: helvetica, color: grayDark });
      page.drawText(`${(total / 100).toFixed(2)} EUR`, { x: 495, y: y, size: 9, font: helveticaBold, color: brandBlack });

      y -= 22;
    });

    y -= 10;
    page.drawLine({
      start: { x: 350, y: y }, end: { x: width - 50, y: y },
      thickness: 1, color: rgb(0.85, 0.85, 0.85)
    });

    y -= 20;

    // ===== TOTALES =====
    const subtotal = order.total_amount || order.total_price || subtotalCalc || 0;
    const discount = order.discount_amount || 0;
    const total = subtotal - discount;

    page.drawText('Subtotal:', { x: 380, y: y, size: 10, font: helvetica, color: grayDark });
    page.drawText(`${(subtotal / 100).toFixed(2)} EUR`, { x: 490, y: y, size: 10, font: helvetica, color: brandBlack });

    y -= 18;
    if (discount > 0) {
      page.drawText('Descuento:', { x: 380, y: y, size: 10, font: helvetica, color: rgb(0, 0.6, 0) });
      page.drawText(`-${(discount / 100).toFixed(2)} EUR`, { x: 490, y: y, size: 10, font: helvetica, color: rgb(0, 0.6, 0) });
      y -= 18;
    }

    page.drawText('Envio:', { x: 380, y: y, size: 10, font: helvetica, color: grayDark });
    page.drawText('GRATIS', { x: 490, y: y, size: 10, font: helveticaBold, color: rgb(0, 0.6, 0) });

    y -= 25;

    // Total destacado con caja roja
    page.drawRectangle({
      x: 365, y: y - 8, width: width - 415, height: 32,
      color: brandRed,
    });
    page.drawText('TOTAL:', { x: 380, y: y + 2, size: 13, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText(`${(total / 100).toFixed(2)} EUR`, { x: 470, y: y + 2, size: 14, font: helveticaBold, color: rgb(1, 1, 1) });

    // ===== PIE DE PÁGINA =====
    // Línea decorativa
    page.drawRectangle({
      x: 0, y: 60, width: width, height: 2,
      color: brandRed,
    });

    page.drawText('Gracias por tu compra en KicksPremium', {
      x: 50, y: 42, size: 9, font: helveticaBold, color: grayDark
    });
    page.drawText('Para consultas: support@kickspremium.com | www.kickspremium.com', {
      x: 50, y: 28, size: 8, font: helvetica, color: grayMedium
    });

    const genDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    page.drawText(sanitizeText(`Factura generada el ${genDate}`), {
      x: width - 180, y: 28, size: 7, font: helvetica, color: grayMedium
    });

    // Generar PDF
    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura-KicksPremium-${invoiceNum}.pdf"`,
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
