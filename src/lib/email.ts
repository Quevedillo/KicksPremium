import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

const FROM_EMAIL = 'noreply@kickspremium.com';
const ADMIN_EMAIL = import.meta.env.ADMIN_EMAIL || 'admin@kickspremium.com';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface OrderDetails {
  orderId: string;
  email: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  shippingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  stripeSessionId?: string;
}

/**
 * Enviar email de confirmación de pedido
 */
export async function sendOrderConfirmationEmail(order: OrderDetails) {
  try {
    // Formato de moneda
    const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`;

    // HTML del email
    const itemsHtml = order.items
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 16px; text-align: left;">
            <div style="font-weight: 500; color: #1f2937;">${item.name}</div>
            <div style="font-size: 14px; color: #6b7280;">Cantidad: ${item.quantity}</div>
          </td>
          <td style="padding: 16px; text-align: right;">
            <div style="font-weight: 500; color: #1f2937;">${formatPrice(item.price)}</div>
          </td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #000000 0%, #1f2937 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 20px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .order-info {
      background-color: #f3f4f6;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .order-info-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }
    .order-info-label {
      color: #6b7280;
      font-weight: 500;
    }
    .order-info-value {
      color: #1f2937;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .items-table {
      background-color: #f9fafb;
    }
    .items-table tr:first-child {
      border-top: 1px solid #e5e7eb;
    }
    .summary {
      background-color: #f9fafb;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .summary-row.total {
      border-top: 2px solid #e5e7eb;
      padding-top: 12px;
      font-size: 18px;
      font-weight: 700;
      color: #000;
    }
    .button {
      display: inline-block;
      background-color: #000;
      color: white;
      padding: 12px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      margin-top: 20px;
    }
    .button:hover {
      background-color: #1f2937;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #000;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 ¡Pedido Confirmado!</h1>
    </div>

    <div class="content">
      <div class="section">
        <p>¡Hola ${order.customerName}!</p>
        <p>Gracias por tu compra en <strong>Kicks Premium</strong>. Hemos recibido tu pedido y está siendo procesado.</p>
      </div>

      <div class="section">
        <div class="section-title">Información del Pedido</div>
        <div class="order-info">
          <div class="order-info-item">
            <span class="order-info-label">Número de Pedido:</span>
            <span class="order-info-value">#${order.orderId.substring(0, 8).toUpperCase()}</span>
          </div>
          <div class="order-info-item">
            <span class="order-info-label">Email de Contacto:</span>
            <span class="order-info-value">${order.email}</span>
          </div>
          <div class="order-info-item">
            <span class="order-info-label">Fecha:</span>
            <span class="order-info-value">${new Date().toLocaleDateString('es-ES')}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Artículos</div>
        <table class="items-table">
          <thead>
            <tr style="background-color: white; border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #1f2937;">Producto</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #1f2937;">Precio</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row">
            <span>Subtotal:</span>
            <span>${formatPrice(order.subtotal)}</span>
          </div>
          <div class="summary-row">
            <span>Impuestos:</span>
            <span>${formatPrice(order.tax)}</span>
          </div>
          <div class="summary-row total">
            <span>Total:</span>
            <span>${formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      ${
        order.shippingAddress
          ? `
        <div class="section">
          <div class="section-title">Dirección de Envío</div>
          <div class="order-info">
            <p style="margin: 0; color: #1f2937;">
              ${order.shippingAddress.line1 || ''}<br>
              ${order.shippingAddress.line2 ? order.shippingAddress.line2 + '<br>' : ''}
              ${order.shippingAddress.postal_code || ''} ${order.shippingAddress.city || ''}<br>
              ${order.shippingAddress.state || ''} ${order.shippingAddress.country || ''}
            </p>
          </div>
        </div>
      `
          : ''
      }

      <div class="section">
        <p style="color: #6b7280; font-size: 14px;">
          <strong>Próximos Pasos:</strong><br>
          Recibirás un email de seguimiento en breve con información del envío. Si tienes cualquier pregunta, no dudes en contactarnos.
        </p>
        <a href="https://kickspremium.com/pedidos" class="button">Ver tu Pedido</a>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0; margin-bottom: 8px;">Kicks Premium - Las mejores zapatillas exclusivas</p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Kicks Premium. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: order.email,
      subject: `Pedido Confirmado #${order.orderId.substring(0, 8).toUpperCase()}`,
      html: htmlContent,
    });

    console.log('Confirmation email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw error;
  }
}

/**
 * Enviar email de bienvenida al newsletter
 */
export async function sendNewsletterWelcomeEmail(email: string) {
  try {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #000000 0%, #1f2937 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 20px;
    }
    .section {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      background-color: #000;
      color: white;
      padding: 12px 32px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      margin-top: 20px;
    }
    .button:hover {
      background-color: #1f2937;
    }
    .benefits {
      list-style: none;
      padding: 0;
      margin: 20px 0;
    }
    .benefits li {
      padding: 12px;
      margin: 8px 0;
      background-color: #f9fafb;
      border-left: 4px solid #000;
      border-radius: 4px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Bienvenido al Newsletter!</h1>
    </div>

    <div class="content">
      <div class="section">
        <h2 style="margin-top: 0; color: #1f2937;">Hola,</h2>
        <p>¡Gracias por suscribirte a nuestro newsletter! Te mantendremos informado sobre:</p>

        <ul class="benefits">
          <li>✨ <strong>Nuevas Colecciones</strong> - Primero en saber sobre nuevos lanzamientos exclusivos</li>
          <li>🎁 <strong>Ofertas Especiales</strong> - Descuentos exclusivos para suscriptores</li>
          <li>🔥 <strong>Limited Editions</strong> - Acceso anticipado a ediciones limitadas</li>
          <li>📰 <strong>Tendencias</strong> - Artículos sobre sneakers, marcas y cultura</li>
        </ul>
      </div>

      <div class="section">
        <p style="color: #6b7280; font-size: 14px;">
          Si no deseas recibir estos emails, puedes darte de baja en cualquier momento haciendo clic en el enlace de desuscripción al pie de cada email.
        </p>
        <a href="https://kickspremium.com" class="button">Visita nuestra Tienda</a>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0; margin-bottom: 8px;">Kicks Premium - Las mejores zapatillas exclusivas</p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Kicks Premium. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: '¡Bienvenido a Kicks Premium!',
      html: htmlContent,
    });

    console.log('Newsletter welcome email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending newsletter welcome email:', error);
    throw error;
  }
}

/**
 * Enviar notificación al admin
 */
export async function sendAdminNotification(
  subject: string,
  message: string,
  metadata?: Record<string, any>
) {
  try {
    const metadataHtml = metadata
      ? `
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 6px; margin-top: 20px;">
          <h3 style="margin-top: 0; color: #1f2937;">Detalles:</h3>
          <pre style="white-space: pre-wrap; word-wrap: break-word; color: #6b7280; font-size: 12px;">
${JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      `
      : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h1 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px;">
      ${subject}
    </h1>
    <p>${message}</p>
    ${metadataHtml}
  </div>
</body>
</html>
    `;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[ADMIN] ${subject}`,
      html: htmlContent,
    });

    console.log('Admin notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw error;
  }
}
