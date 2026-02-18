import nodemailer from 'nodemailer';

// URL base del sitio (configurable por entorno)
const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'https://kickspremium.com';

// Configuración SMTP de Gmail
const SMTP_HOST = import.meta.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(import.meta.env.SMTP_PORT || '587');
const SMTP_USER = import.meta.env.SMTP_USER;
const SMTP_PASS = import.meta.env.SMTP_PASS;
const FROM_EMAIL_CONFIG = import.meta.env.FROM_EMAIL || SMTP_USER;

if (!SMTP_USER || !SMTP_PASS) {
  console.error(
    '❌ ERROR CRÍTICO: Credenciales SMTP no configuradas en .env\n' +
    'Los emails NO serán enviados hasta que configures SMTP_USER y SMTP_PASS.\n' +
    'Usa una contraseña de aplicación de Gmail.'
  );
}

// Crear transporter de nodemailer
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true para 465, false para otros puertos
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Función para enviar emails usando SMTP (Gmail)
 */
export async function sendEmailWithSMTP(options: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('⚠️ Credenciales SMTP no configuradas. Email no será enviado.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const toArray = Array.isArray(options.to) ? options.to : [options.to];
    
    const mailOptions: any = {
      from: `"Kicks Premium" <${options.from || FROM_EMAIL_CONFIG}>`,
      to: toArray.join(', '),
      subject: options.subject,
      html: options.html,
    };

    // Agregar adjuntos si existen
    if (options.attachments && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      }));
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email enviado via SMTP:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email via SMTP:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Verificar conexión SMTP al iniciar
if (SMTP_USER && SMTP_PASS) {
  transporter.verify()
    .then(() => {
      console.log('✅ Conexión SMTP verificada correctamente');
      console.log(`   → Servidor: ${SMTP_HOST}:${SMTP_PORT}`);
      console.log(`   → Usuario: ${SMTP_USER}`);
    })
    .catch((error) => {
      console.error('❌ Error verificando conexión SMTP:', error);
    });
}

/**
 * Email desde donde se envían los correos
 * Configurado con tu cuenta de Gmail
 */
const FROM_EMAIL = FROM_EMAIL_CONFIG;
const ADMIN_EMAIL = import.meta.env.ADMIN_EMAIL || 'admin@kickspremium.com';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
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
  invoicePDF?: Buffer; // PDF de factura como buffer
}

/**
 * Enviar email de confirmación de pedido con factura
 */
export async function sendOrderConfirmationEmail(order: OrderDetails) {
  try {
    // Validar que está configurado SMTP
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('⚠️ Credenciales SMTP no configuradas. Email no será enviado.');
      return { success: false, error: 'Email service not configured' };
    }

    // Formato de moneda
    const formatPrice = (cents: number) => {
      const val = Number(cents);
      if (isNaN(val)) return '€0.00';
      return `€${(val / 100).toFixed(2)}`;
    };

    // HTML del email
    const itemsHtml = order.items
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 16px; text-align: left; width: 80px; vertical-align: top;">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;" />` : `<div style="width: 70px; height: 70px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 28px;">👟</div>`}
          </td>
          <td style="padding: 16px; text-align: left; vertical-align: top;">
            <div style="font-weight: 600; color: #1f2937; font-size: 15px;">${item.name}</div>
            ${item.size ? `<div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Talla: ${item.size}</div>` : ''}
            <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">Cantidad: ${item.quantity}</div>
          </td>
          <td style="padding: 16px; text-align: right; vertical-align: top;">
            <div style="font-weight: 600; color: #1f2937; font-size: 15px;">${formatPrice(item.price * item.quantity)}</div>
            ${item.quantity > 1 ? `<div style="font-size: 12px; color: #9ca3af;">${formatPrice(item.price)} c/u</div>` : ''}
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
        <table class="items-table" style="width: 100%;">
          <thead>
            <tr style="background-color: white; border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #1f2937; width: 80px;"></th>
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
        <a href="${SITE_URL}/pedidos" class="button">Ver tu Pedido</a>
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

    // Construir attachments
    const attachments: any[] = [];
    if (order.invoicePDF) {
      attachments.push({
        filename: `Factura_${order.orderId.substring(0, 8).toUpperCase()}.pdf`,
        content: order.invoicePDF,
        contentType: 'application/pdf',
      });
    }

    const result = await sendEmailWithSMTP({
      to: order.email,
      subject: `Pedido Confirmado #${order.orderId.substring(0, 8).toUpperCase()}`,
      html: htmlContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (!result.success) {
      console.error('⚠️ Error enviando email de confirmación:', result.error);
      return { success: false, error: result.error };
    }

    console.log('✅ Confirmation email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('⚠️ Error sending order confirmation email (no-fail):', error);
    // NO lanzar error - el pedido ya fue creado
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Enviar email de bienvenida al newsletter con código de descuento
 */
export async function sendNewsletterWelcomeEmail(email: string, discountCode: string = 'WELCOME10') {
  try {
    // Validar que está configurado SMTP
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('⚠️ Credenciales SMTP no configuradas. Email de newsletter no será enviado.');
      return { success: false, error: 'Email service not configured' };
    }

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
    .discount-box {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      padding: 24px;
      border-radius: 8px;
      text-align: center;
      margin: 24px 0;
    }
    .discount-code {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 3px;
      font-family: monospace;
      background: rgba(255,255,255,0.2);
      padding: 12px 24px;
      border-radius: 6px;
      display: inline-block;
      margin-top: 8px;
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
      <h1>🎉 ¡Bienvenido a Kicks Premium!</h1>
    </div>

    <div class="content">
      <div class="section">
        <h2 style="margin-top: 0; color: #1f2937;">¡Gracias por unirte!</h2>
        <p>Como agradecimiento por suscribirte a nuestra newsletter, aquí tienes tu código de descuento exclusivo:</p>
        
        <div class="discount-box">
          <p style="margin: 0; font-size: 16px;">Tu código de descuento del 10%</p>
          <div class="discount-code">${discountCode}</div>
          <p style="margin: 12px 0 0 0; font-size: 13px; opacity: 0.9;">Válido por 30 días en compras superiores a 50€</p>
        </div>
      </div>

      <div class="section">
        <p>Te mantendremos informado sobre:</p>
        <ul class="benefits">
          <li>✨ <strong>Nuevas Colecciones</strong> - Primero en saber sobre nuevos lanzamientos exclusivos</li>
          <li>🎁 <strong>Ofertas Especiales</strong> - Descuentos exclusivos para suscriptores</li>
          <li>🔥 <strong>Limited Editions</strong> - Acceso anticipado a ediciones limitadas</li>
          <li>📰 <strong>Tendencias</strong> - Artículos sobre sneakers, marcas y cultura</li>
        </ul>
      </div>

      <div class="section" style="text-align: center;">
        <a href="${SITE_URL}" class="button">Usar mi código ahora</a>
      </div>

      <div class="section">
        <p style="color: #6b7280; font-size: 14px;">
          Si no deseas recibir estos emails, puedes <a href="${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #000; text-decoration: underline;">darte de baja</a> en cualquier momento.
        </p>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0; margin-bottom: 8px;">Kicks Premium - Las mejores zapatillas exclusivas</p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Kicks Premium. Todos los derechos reservados.</p>
      <p style="margin-top: 8px; font-size: 11px;">
        <a href="${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #9ca3af; text-decoration: underline;">Darse de baja del newsletter</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await sendEmailWithSMTP({
      to: email,
      subject: '🎁 ¡Tu código de descuento del 10% está aquí!',
      html: htmlContent,
    });

    if (!result.success) {
      console.error('⚠️ Error enviando email de newsletter:', result.error);
      return { success: false, error: result.error };
    }

    console.log('✅ Newsletter welcome email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('⚠️ Error sending newsletter welcome email (no-fail):', error);
    // NO lanzar error - la suscripción ya fue creada
    // El usuario puede recibir el código por otro método
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Interface para datos de producto en newsletter
 */
interface ProductNewsletterData {
  name: string;
  slug: string;
  description: string;
  price: number; // en centimos
  images: string[];
  brand?: string | null;
  category?: string | null;
  isLimitedEdition?: boolean;
}

/**
 * Enviar email de nuevo producto a un suscriptor del newsletter
 */
export async function sendNewProductEmail(
  subscriberEmail: string,
  product: ProductNewsletterData
) {
  try {
    // Validar que está configurado SMTP
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn(`⚠️ Credenciales SMTP no configuradas. Email a ${subscriberEmail} no será enviado.`);
      throw new Error('Email service not configured');
    }

    const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`;
    const productUrl = `${SITE_URL}/productos/${product.slug}`;
    const mainImage = product.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80';

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
      margin: 0;
      padding: 0;
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
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header .badge {
      display: inline-block;
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .product-image {
      width: 100%;
      max-height: 350px;
      object-fit: cover;
    }
    .content {
      padding: 30px 20px;
    }
    .product-name {
      font-size: 22px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 8px 0;
    }
    .product-brand {
      font-size: 14px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
    }
    .product-description {
      color: #4b5563;
      font-size: 15px;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .price-section {
      background-color: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      text-align: center;
    }
    .price {
      font-size: 32px;
      font-weight: 700;
      color: #000;
    }
    .limited-badge {
      display: inline-block;
      background-color: #fef3c7;
      color: #92400e;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 10px;
    }
    .button {
      display: block;
      background-color: #000;
      color: white;
      padding: 16px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      text-align: center;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #1f2937;
    }
    .footer {
      background-color: #1f2937;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer a {
      color: #9ca3af;
      text-decoration: underline;
    }
    .unsubscribe {
      margin-top: 12px;
      font-size: 11px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔥 ¡NUEVO DROP!</h1>
      <span class="badge">Exclusivo para suscriptores</span>
    </div>

    <img src="${mainImage}" alt="${product.name}" class="product-image" />

    <div class="content">
      ${product.brand ? `<div class="product-brand">${product.brand}</div>` : ''}
      
      <h2 class="product-name">
        ${product.name}
        ${product.isLimitedEdition ? '<span class="limited-badge">⚡ Edición Limitada</span>' : ''}
      </h2>
      
      ${product.category ? `<p style="color: #6b7280; font-size: 13px; margin: 0 0 16px 0;">Categoría: ${product.category}</p>` : ''}
      
      <p class="product-description">${product.description}</p>
      
      <div class="price-section">
        <span class="price">${formatPrice(product.price)}</span>
      </div>
      
      <a href="${productUrl}" class="button">
        Ver Producto →
      </a>
      
      <p style="text-align: center; color: #6b7280; font-size: 13px; margin-top: 16px;">
        ¡No te lo pierdas! Los drops exclusivos vuelan rápido 🚀
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0; margin-bottom: 8px;">
        <strong style="color: white;">KICKS</strong><span style="color: #ef4444;">PREMIUM</span>
      </p>
      <p style="margin: 0;">Las mejores zapatillas exclusivas</p>
      <p class="unsubscribe">
        ¿No quieres recibir más emails? <a href="${SITE_URL}/unsubscribe?email=${encodeURIComponent(subscriberEmail)}">Darse de baja</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await sendEmailWithSMTP({
      to: subscriberEmail,
      subject: `🔥 ¡Nuevo Drop! ${product.name}`,
      html: htmlContent,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }
    
    return result;
  } catch (error) {
    console.error(`Error sending new product email to ${subscriberEmail}:`, error);
    throw error;
  }
}

/**
 * Enviar notificación de nuevo producto a todos los suscriptores del newsletter
 * Retorna un resumen del envío
 */
export async function sendNewProductToAllSubscribers(
  subscribers: { email: string }[],
  product: ProductNewsletterData
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Enviar emails en lotes para evitar rate limits
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN_BATCHES = 1000; // 1 segundo entre lotes

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (subscriber) => {
      try {
        await sendNewProductEmail(subscriber.email, product);
        results.sent++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${subscriber.email}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    await Promise.all(batchPromises);

    // Esperar antes del siguiente lote (excepto en el último)
    if (i + BATCH_SIZE < subscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log(
    `Newsletter enviado: ${results.sent} enviados, ${results.failed} fallidos de ${subscribers.length} suscriptores`
  );

  return results;
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
    // Validar que está configurado SMTP
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('⚠️ Credenciales SMTP no configuradas. Email a admin no será enviado.');
      return { success: false, error: 'Email service not configured' };
    }

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

    const result = await sendEmailWithSMTP({
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

/**
 * Interface para datos de cancelación
 */
interface OrderCancellationData {
  orderId: string;
  email: string;
  customerName: string;
  reason?: string;
}

/**
 * Enviar email de confirmación de cancelación de pedido
 */
export async function sendOrderCancellationEmail(data: OrderCancellationData) {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('⚠️ Credenciales SMTP no configuradas. Email de cancelación no será enviado.');
      return { success: false, error: 'Email service not configured' };
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 40px 20px; }
    .info-box { background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; background-color: #000; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 20px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Pedido Cancelado</h1>
    </div>
    <div class="content">
      <p>Hola ${data.customerName},</p>
      <p>Tu pedido ha sido cancelado correctamente.</p>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>Número de pedido:</strong> #${data.orderId.substring(0, 8).toUpperCase()}</p>
        ${data.reason ? `<p style="margin: 8px 0 0 0;"><strong>Motivo:</strong> ${data.reason}</p>` : ''}
      </div>
      
      <p>Si realizaste el pago con tarjeta, el reembolso se procesará automáticamente en 5-10 días hábiles.</p>
      
      <p style="margin-top: 24px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
      
      <a href="${SITE_URL}/productos" class="button">Seguir comprando</a>
    </div>
    <div class="footer">
      <p style="margin: 0;">© ${new Date().getFullYear()} Kicks Premium. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await sendEmailWithSMTP({
      to: data.email,
      subject: `Pedido #${data.orderId.substring(0, 8).toUpperCase()} cancelado`,
      html: htmlContent,
    });

    console.log('✅ Cancellation email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending cancellation email:', error);
    throw error;
  }
}

/**
 * Interface para datos de devolución
 */
interface ReturnRequestData {
  orderId: string;
  email: string;
  customerName: string;
  items: any[];
  returnAddress: {
    name: string;
    line1: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

/**
 * Enviar email con instrucciones de devolución
 */
export async function sendReturnRequestEmail(data: ReturnRequestData) {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('⚠️ Credenciales SMTP no configuradas. Email de devolución no será enviado.');
      return { success: false, error: 'Email service not configured' };
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 40px 20px; }
    .address-box { background-color: #fef3c7; border: 2px dashed #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .steps { counter-reset: step; list-style: none; padding: 0; }
    .steps li { counter-increment: step; padding: 16px 0 16px 50px; position: relative; border-bottom: 1px solid #e5e7eb; }
    .steps li::before { content: counter(step); position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; background: #000; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 Solicitud de Devolución</h1>
    </div>
    <div class="content">
      <p>Hola ${data.customerName},</p>
      <p>Hemos recibido tu solicitud de devolución para el pedido <strong>#${data.orderId.substring(0, 8).toUpperCase()}</strong>.</p>
      
      <h3 style="color: #1f2937; margin-top: 24px;">📋 Pasos para completar la devolución:</h3>
      
      <ol class="steps">
        <li><strong>Empaqueta los productos</strong><br>Asegúrate de que estén en su embalaje original y en perfecto estado.</li>
        <li><strong>Incluye este número de referencia</strong><br>Escribe <strong>#${data.orderId.substring(0, 8).toUpperCase()}</strong> en el exterior del paquete.</li>
        <li><strong>Envía a nuestra dirección</strong><br>Consulta la dirección de devolución abajo.</li>
        <li><strong>Espera confirmación</strong><br>Te notificaremos cuando recibamos el paquete y procesemos el reembolso.</li>
      </ol>
      
      <h3 style="color: #1f2937; margin-top: 24px;">📍 Dirección de devolución:</h3>
      <div class="address-box">
        <p style="margin: 0; font-weight: bold;">${data.returnAddress.name}</p>
        <p style="margin: 4px 0 0 0;">${data.returnAddress.line1}</p>
        <p style="margin: 4px 0 0 0;">${data.returnAddress.postalCode} ${data.returnAddress.city}</p>
        <p style="margin: 4px 0 0 0;">${data.returnAddress.country}</p>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        <strong>Nota:</strong> El reembolso se procesará en 5-10 días hábiles después de recibir y verificar los productos.
        Los gastos de envío de la devolución corren por cuenta del cliente.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">© ${new Date().getFullYear()} Kicks Premium. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await sendEmailWithSMTP({
      to: data.email,
      subject: `Instrucciones de devolución - Pedido #${data.orderId.substring(0, 8).toUpperCase()}`,
      html: htmlContent,
    });

    console.log('✅ Return instructions email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending return email:', error);
    throw error;
  }
}

/**
 * Enviar notificación de nuevo pedido al administrador
 */
export async function sendAdminOrderNotification(order: OrderDetails) {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('⚠️ Credenciales SMTP no configuradas. Email de notificación admin no será enviado.');
      return { success: false, error: 'Email service not configured' };
    }

    const formatPrice = (cents: number) => {
      const val = Number(cents);
      if (isNaN(val)) return '€0.00';
      return `€${(val / 100).toFixed(2)}`;
    };

    const itemsHtml = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; width: 60px; vertical-align: top;">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb;" />` : `<div style="width: 50px; height: 50px; background: #f3f4f6; border-radius: 6px; text-align: center; line-height: 50px; font-size: 22px;">👟</div>`}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 500;">${item.name}</div>
            ${item.size ? `<div style="font-size: 12px; color: #6b7280;">Talla: ${item.size}</div>` : ''}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatPrice(item.price)}</td>
        </tr>
      `
      )
      .join('');

    const shippingHtml = order.shippingAddress
      ? `
        <p><strong>Dirección de envío:</strong></p>
        <p style="margin-left: 20px;">
          ${order.shippingAddress.line1 || ''}<br>
          ${order.shippingAddress.line2 ? order.shippingAddress.line2 + '<br>' : ''}
          ${order.shippingAddress.postal_code || ''} ${order.shippingAddress.city || ''}<br>
          ${order.shippingAddress.state || ''} ${order.shippingAddress.country || ''}
        </p>
      `
      : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">🎉 ¡Nuevo Pedido!</h1>
  </div>
  
  <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
    <p><strong>Pedido:</strong> #${order.orderId.substring(0, 8).toUpperCase()}</p>
    <p><strong>Cliente:</strong> ${order.customerName}</p>
    <p><strong>Email:</strong> ${order.email}</p>
    <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
    
    ${shippingHtml}
    
    <h3 style="margin-top: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Productos</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; text-align: left; width: 60px;"></th>
          <th style="padding: 8px; text-align: left;">Producto</th>
          <th style="padding: 8px; text-align: center;">Cant.</th>
          <th style="padding: 8px; text-align: right;">Precio</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; text-align: right;">
      <p style="margin: 4px 0;"><strong>Subtotal:</strong> ${formatPrice(order.subtotal)}</p>
      <p style="margin: 4px 0;"><strong>IVA:</strong> ${formatPrice(order.tax)}</p>
      <p style="margin: 4px 0; font-size: 18px; color: #059669;"><strong>TOTAL:</strong> ${formatPrice(order.total)}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="${import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321'}/admin/pedidos/${order.orderId}" 
         style="display: inline-block; background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Ver Pedido en Admin
      </a>
    </div>
  </div>
  
  <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #6b7280;">
    <p style="margin: 0;">Este email fue enviado automáticamente por Kicks Premium</p>
  </div>
</body>
</html>
    `;

    const result = await sendEmailWithSMTP({
      to: ADMIN_EMAIL,
      subject: `🎉 Nuevo Pedido #${order.orderId.substring(0, 8).toUpperCase()} - ${formatPrice(order.total)}`,
      html: htmlContent,
    });

    console.log('✅ Admin notification email sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending admin notification email:', error);
    throw error;
  }
}

/**
 * Enviar email de carrito abandonado / pago cancelado
 */
export async function sendAbandonedCartEmail(email: string) {
  try {
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('⚠️ Credenciales SMTP no configuradas. Email de carrito abandonado no será enviado.');
      return { success: false, error: 'Email service not configured' };
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #000000 0%, #1f2937 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 40px 20px; text-align: center; }
    .button { display: inline-block; background-color: #dc2626; color: white; padding: 16px 40px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 16px; margin-top: 20px; text-transform: uppercase; }
    .discount-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px dashed #f59e0b; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .discount-code { font-size: 28px; font-weight: 800; color: #d97706; letter-spacing: 2px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛒 ¿Olvidaste algo?</h1>
    </div>
    <div class="content">
      <p style="font-size: 18px;">¡Notamos que no completaste tu compra!</p>
      <p>Tus productos favoritos siguen esperándote en tu carrito.</p>
      
      <div class="discount-box">
        <p style="margin: 0 0 8px 0; font-weight: 600;">¡Usa este código para obtener un 10% de descuento!</p>
        <p class="discount-code" style="margin: 0;">VUELVE10</p>
      </div>
      
      <p>No dejes escapar las zapatillas más exclusivas.</p>
      
      <a href="${SITE_URL}/carrito" class="button">Completar mi compra</a>
      
      <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">
        Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">© ${new Date().getFullYear()} Kicks Premium. Todos los derechos reservados.</p>
      <p style="margin: 8px 0 0 0;">
        <a href="${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #6b7280;">Darse de baja</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const result = await sendEmailWithSMTP({
      to: email,
      subject: '🛒 ¿Olvidaste algo en tu carrito? - 10% de descuento',
      html: htmlContent,
    });

    console.log('✅ Abandoned cart email sent:', result);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending abandoned cart email:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
