import PDFDocument from 'pdfkit';

// IVA rate for Spain
const IVA_RATE = 0.21;

export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number; // Price in cents WITH IVA included
  size?: string;
  image?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
  };
  items: InvoiceItem[];
  subtotal: number;  // Will be recalculated as base imponible
  tax: number;       // Will be recalculated as IVA
  discount?: number;
  total: number;
  orderStatus: string;
}

/**
 * Descargar imagen desde URL y devolver como Buffer
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error fetching image for invoice:', error);
    return null;
  }
}

/**
 * Formatear precio de centavos a euros
 */
function formatEUR(cents: number): string {
  const val = Number(cents);
  if (isNaN(val)) return '0,00 €';
  return `${(val / 100).toFixed(2).replace('.', ',')} €`;
}

/**
 * Calcular base imponible (precio sin IVA) desde precio con IVA incluido
 * @param priceWithIVA Precio en céntimos con IVA incluido
 * @returns Precio en céntimos sin IVA (base imponible)
 */
function getBasePrice(priceWithIVA: number): number {
  return Math.round(priceWithIVA / (1 + IVA_RATE));
}

/**
 * Calcular IVA desde precio con IVA incluido
 * @param priceWithIVA Precio en céntimos con IVA incluido
 * @returns Cantidad de IVA en céntimos
 */
function getIVAAmount(priceWithIVA: number): number {
  return priceWithIVA - getBasePrice(priceWithIVA);
}

// Colores corporativos
const COLORS = {
  black: '#000000',
  darkGray: '#1a1a2e',
  mediumGray: '#374151',
  lightGray: '#6b7280',
  borderGray: '#e5e7eb',
  bgLight: '#f9fafb',
  bgAccent: '#f3f4f6',
  red: '#EF4444',
  redDark: '#DC2626',
  orange: '#F97316',
  white: '#FFFFFF',
  green: '#10B981',
};

/**
 * Generar factura PDF premium con desglose IVA
 * Los precios se almacenan CON IVA incluido.
 * En la factura se muestra: precio base (sin IVA), IVA y total con IVA.
 */
export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Pre-fetch product images
      const imageBuffers: (Buffer | null)[] = [];
      for (const item of data.items) {
        if (item.image) {
          const buf = await fetchImageBuffer(item.image);
          imageBuffers.push(buf);
        } else {
          imageBuffers.push(null);
        }
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      const pageWidth = 595.28;
      const marginLeft = 40;
      const marginRight = 40;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // ===== HEADER BAR (Negro) =====
      doc
        .rect(0, 0, pageWidth, 80)
        .fill(COLORS.black);

      // Logo text
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text('KICKS', marginLeft, 25, { continued: true })
        .fillColor(COLORS.red)
        .text('PREMIUM', { continued: false });

      doc
        .fontSize(9)
        .fillColor('#999999')
        .text('AUTHENTIC SNEAKERS', marginLeft, 52);

      // Número de factura en la derecha
      doc
        .fontSize(10)
        .fillColor(COLORS.white)
        .text('FACTURA', pageWidth - marginRight - 150, 22, { width: 150, align: 'right' })
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`#${data.invoiceNumber}`, pageWidth - marginRight - 150, 37, { width: 150, align: 'right' });

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#999999')
        .text(data.date, pageWidth - marginRight - 150, 56, { width: 150, align: 'right' });

      // ===== ESTADO DEL PEDIDO =====
      const statusY = 95;
      const statusText = data.orderStatus;
      const statusColor = statusText === 'Pagado' ? COLORS.green : statusText === 'Enviado' ? '#6366f1' : statusText === 'Pendiente' ? COLORS.orange : COLORS.mediumGray;

      doc
        .roundedRect(marginLeft, statusY, 120, 24, 4)
        .fill(statusColor);

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text(statusText.toUpperCase(), marginLeft + 10, statusY + 7, { width: 100, align: 'center' });

      // ===== DATOS EMPRESA (emisor) =====
      const companyY = 95;
      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor(COLORS.lightGray)
        .text('Kicks Premium S.L.', pageWidth - marginRight - 180, companyY, { width: 180, align: 'right' })
        .text('CIF: B12345678', pageWidth - marginRight - 180, companyY + 10, { width: 180, align: 'right' })
        .text('info@kickspremium.com', pageWidth - marginRight - 180, companyY + 20, { width: 180, align: 'right' });

      // ===== INFO CLIENTE Y ENVÍO =====
      const infoY = 135;

      // Caja cliente
      doc
        .roundedRect(marginLeft, infoY, contentWidth / 2 - 10, 90, 6)
        .fill(COLORS.bgAccent);

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(COLORS.lightGray)
        .text('DATOS DEL CLIENTE', marginLeft + 15, infoY + 12);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(COLORS.black)
        .text(data.customerName, marginLeft + 15, infoY + 28, { width: contentWidth / 2 - 40 });

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(COLORS.mediumGray)
        .text(data.customerEmail, marginLeft + 15, infoY + 45, { width: contentWidth / 2 - 40 });

      if (data.customerPhone) {
        doc.text(data.customerPhone, marginLeft + 15, infoY + 60, { width: contentWidth / 2 - 40 });
      }

      // Caja envío
      if (data.shippingAddress) {
        const shipX = marginLeft + contentWidth / 2 + 10;
        doc
          .roundedRect(shipX, infoY, contentWidth / 2 - 10, 90, 6)
          .fill(COLORS.bgAccent);

        doc
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor(COLORS.lightGray)
          .text('DIRECCIÓN DE ENVÍO', shipX + 15, infoY + 12);

        let shipTextY = infoY + 28;
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(COLORS.mediumGray);

        doc.text(data.shippingAddress.line1, shipX + 15, shipTextY, { width: contentWidth / 2 - 40 });
        shipTextY += 14;

        if (data.shippingAddress.line2) {
          doc.text(data.shippingAddress.line2, shipX + 15, shipTextY, { width: contentWidth / 2 - 40 });
          shipTextY += 14;
        }

        doc.text(
          `${data.shippingAddress.postal_code} ${data.shippingAddress.city}`,
          shipX + 15, shipTextY, { width: contentWidth / 2 - 40 }
        );
        shipTextY += 14;

        doc.text(
          `${data.shippingAddress.state || ''} ${data.shippingAddress.country}`.trim(),
          shipX + 15, shipTextY, { width: contentWidth / 2 - 40 }
        );
      }

      // ===== TABLA DE PRODUCTOS =====
      const tableTop = 245;

      // Header de tabla
      doc
        .rect(marginLeft, tableTop, contentWidth, 28)
        .fill(COLORS.darkGray);

      // Column positions - well-spaced to avoid overlap
      const col1X = marginLeft + 8;        // Imagen (width: 45)
      const col2X = marginLeft + 58;       // Producto (flexible)
      const col3X = marginLeft + 280;      // Cant. (width: 40)
      const col4X = marginLeft + 325;      // P.Unit sin IVA (width: 75)
      const col5X = marginLeft + 410;      // Total sin IVA (width: 75)

      doc
        .fontSize(7)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text('', col1X, tableTop + 9)
        .text('PRODUCTO', col2X, tableTop + 9)
        .text('CANT.', col3X, tableTop + 9, { width: 40, align: 'center' })
        .text('P.UNIT (sin IVA)', col4X, tableTop + 9, { width: 75, align: 'right' })
        .text('TOTAL (sin IVA)', col5X, tableTop + 9, { width: 75, align: 'right' });

      // Items
      let itemY = tableTop + 35;

      // Calculate IVA details per item
      let totalBaseImponible = 0;

      data.items.forEach((item, index) => {
        const unitBasePrice = getBasePrice(item.price);
        const lineTotal = unitBasePrice * item.quantity;
        totalBaseImponible += lineTotal;
        const rowHeight = 55;
        const isEven = index % 2 === 0;

        // Fondo alternado
        if (isEven) {
          doc
            .rect(marginLeft, itemY - 5, contentWidth, rowHeight)
            .fill('#fafafa');
        }

        // Imagen del producto
        const imgBuf = imageBuffers[index];
        if (imgBuf) {
          try {
            doc.image(imgBuf, col1X, itemY, {
              width: 42,
              height: 42,
              fit: [42, 42],
            });
          } catch (e) {
            doc
              .roundedRect(col1X, itemY, 42, 42, 4)
              .fill(COLORS.bgAccent);
            doc.fontSize(16).fillColor(COLORS.lightGray).text('👟', col1X + 10, itemY + 12);
          }
        } else {
          doc
            .roundedRect(col1X, itemY, 42, 42, 4)
            .fill(COLORS.bgAccent);
          doc.fontSize(16).fillColor(COLORS.lightGray).text('👟', col1X + 10, itemY + 12);
        }

        // Nombre del producto
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor(COLORS.black)
          .text(item.name, col2X, itemY + 5, { width: col3X - col2X - 10, height: 28 });

        // Talla si existe
        if (item.size) {
          doc
            .fontSize(8)
            .font('Helvetica')
            .fillColor(COLORS.lightGray)
            .text(`Talla: ${item.size}`, col2X, itemY + 22);
        }

        // Cantidad
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(COLORS.mediumGray)
          .text(item.quantity.toString(), col3X, itemY + 14, { width: 40, align: 'center' });

        // Precio unitario SIN IVA
        doc
          .fontSize(9)
          .text(formatEUR(unitBasePrice), col4X, itemY + 14, { width: 75, align: 'right' });

        // Total de línea SIN IVA
        doc
          .font('Helvetica-Bold')
          .fillColor(COLORS.black)
          .text(formatEUR(lineTotal), col5X, itemY + 14, { width: 75, align: 'right' });

        itemY += rowHeight;
      });

      // ===== LÍNEA SEPARADORA =====
      doc
        .moveTo(marginLeft, itemY + 5)
        .lineTo(pageWidth - marginRight, itemY + 5)
        .strokeColor(COLORS.borderGray)
        .lineWidth(1)
        .stroke();

      // ===== RESUMEN DE TOTALES CON IVA =====
      const totalIVA = Math.round(totalBaseImponible * IVA_RATE);
      const totalFinal = totalBaseImponible + totalIVA;

      const summaryX = pageWidth - marginRight - 240;
      let summaryY = itemY + 18;

      // Base Imponible
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(COLORS.mediumGray)
        .text('Base Imponible:', summaryX, summaryY, { width: 140, align: 'right' });
      doc
        .font('Helvetica')
        .text(formatEUR(totalBaseImponible), summaryX + 150, summaryY, { width: 90, align: 'right' });

      summaryY += 20;

      // IVA
      doc
        .fillColor(COLORS.mediumGray)
        .text(`IVA (${(IVA_RATE * 100).toFixed(0)}%):`, summaryX, summaryY, { width: 140, align: 'right' });
      doc
        .text(formatEUR(totalIVA), summaryX + 150, summaryY, { width: 90, align: 'right' });

      summaryY += 20;

      // Descuento
      if (data.discount && data.discount > 0) {
        doc
          .fillColor(COLORS.green)
          .text('Descuento:', summaryX, summaryY, { width: 140, align: 'right' });
        doc
          .text(`-${formatEUR(data.discount)}`, summaryX + 150, summaryY, { width: 90, align: 'right' });
        summaryY += 20;
      }

      summaryY += 5;

      // ===== TOTAL DESTACADO =====
      doc
        .roundedRect(summaryX, summaryY, 240, 40, 6)
        .fill(COLORS.black);

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text('TOTAL (IVA incl.):', summaryX + 15, summaryY + 12, { width: 110 });

      doc
        .fontSize(18)
        .fillColor(COLORS.red)
        .text(formatEUR(totalFinal), summaryX + 130, summaryY + 8, { width: 95, align: 'right' });

      // ===== NOTA FISCAL =====
      const noteY = summaryY + 52;
      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor(COLORS.lightGray)
        .text(
          'Los precios mostrados en el catálogo incluyen IVA. Esta factura desglosa la base imponible y el IVA aplicado conforme a la legislación vigente.',
          marginLeft, noteY,
          { width: contentWidth, align: 'left' }
        );

      // ===== PIE DE PÁGINA =====
      const footerY = 730;

      doc
        .moveTo(marginLeft, footerY)
        .lineTo(pageWidth - marginRight, footerY)
        .strokeColor(COLORS.borderGray)
        .lineWidth(0.5)
        .stroke();

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(COLORS.lightGray)
        .text(
          'Gracias por tu compra en Kicks Premium.',
          marginLeft, footerY + 12,
          { width: contentWidth, align: 'center' }
        );

      doc
        .text(
          'Para consultas sobre tu pedido, visita kickspremium.victoriafp.online o contacta con nuestro equipo de soporte.',
          marginLeft, footerY + 24,
          { width: contentWidth, align: 'center' }
        );

      doc
        .fontSize(7)
        .fillColor('#b0b0b0')
        .text(
          `Documento generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`,
          marginLeft, footerY + 42,
          { width: contentWidth, align: 'center' }
        );

      // Barra inferior decorativa
      doc
        .rect(0, 800, pageWidth, 22)
        .fill(COLORS.black);

      doc
        .fontSize(7)
        .font('Helvetica-Bold')
        .fillColor('#999999')
        .text('KICKS', marginLeft, 804, { continued: true })
        .fillColor(COLORS.red)
        .text('PREMIUM', { continued: true })
        .fillColor('#666666')
        .font('Helvetica')
        .text('  •  kickspremium.victoriafp.online  •  Authentic Sneakers', { continued: false });

      // Finalizar documento
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generar nombre de archivo para factura
 */
export function generateInvoiceFilename(invoiceNumber: string): string {
  return `Factura_${invoiceNumber}.pdf`;
}

// ============================================================================
// FACTURA DE CANCELACIÓN
// ============================================================================

export interface CancellationInvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
  };
  items: InvoiceItem[];
  subtotal: number;  // Will be recalculated as base imponible
  tax: number;       // Will be recalculated as IVA
  total: number;
  cancellationReason: string;
  refundAmount: number;
  refundStatus: string;
  originalOrderDate: string;
}

/**
 * Generar factura de cancelación/reembolso PDF con desglose IVA
 */
export function generateCancellationInvoicePDF(data: CancellationInvoiceData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Pre-fetch product images
      const imageBuffers: (Buffer | null)[] = [];
      for (const item of data.items) {
        if (item.image) {
          const buf = await fetchImageBuffer(item.image);
          imageBuffers.push(buf);
        } else {
          imageBuffers.push(null);
        }
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = 595.28;
      const marginLeft = 40;
      const marginRight = 40;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // ===== HEADER BAR (Rojo para cancelación) =====
      doc.rect(0, 0, pageWidth, 80).fill(COLORS.redDark);

      // Logo text
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text('KICKS', marginLeft, 25, { continued: true })
        .fillColor('#ffcccc')
        .text('PREMIUM', { continued: false });

      doc
        .fontSize(9)
        .fillColor('#ff9999')
        .text('FACTURA DE CANCELACIÓN', marginLeft, 52);

      // Número de factura
      doc
        .fontSize(10)
        .fillColor(COLORS.white)
        .text('CANCELACIÓN', pageWidth - marginRight - 150, 22, { width: 150, align: 'right' })
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(`#${data.invoiceNumber}`, pageWidth - marginRight - 150, 37, { width: 150, align: 'right' });

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#ff9999')
        .text(data.date, pageWidth - marginRight - 150, 56, { width: 150, align: 'right' });

      // ===== ESTADO: CANCELADO =====
      const statusY = 95;
      doc.roundedRect(marginLeft, statusY, 140, 24, 4).fill(COLORS.red);
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text('PEDIDO CANCELADO', marginLeft + 10, statusY + 7, { width: 120, align: 'center' });

      // Reembolso badge
      const refundStatusText = data.refundStatus === 'succeeded' ? 'REEMBOLSO COMPLETADO' : 'REEMBOLSO EN PROCESO';
      const refundColor = data.refundStatus === 'succeeded' ? COLORS.green : COLORS.orange;
      doc.roundedRect(marginLeft + 150, statusY, 160, 24, 4).fill(refundColor);
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text(refundStatusText, marginLeft + 160, statusY + 7, { width: 140, align: 'center' });

      // ===== INFO CLIENTE =====
      const infoY = 135;
      doc.roundedRect(marginLeft, infoY, contentWidth / 2 - 10, 90, 6).fill(COLORS.bgAccent);

      doc
        .fontSize(8).font('Helvetica-Bold').fillColor(COLORS.lightGray)
        .text('DATOS DEL CLIENTE', marginLeft + 15, infoY + 12);
      doc
        .fontSize(11).font('Helvetica-Bold').fillColor(COLORS.black)
        .text(data.customerName, marginLeft + 15, infoY + 28, { width: contentWidth / 2 - 40 });
      doc
        .fontSize(9).font('Helvetica').fillColor(COLORS.mediumGray)
        .text(data.customerEmail, marginLeft + 15, infoY + 45, { width: contentWidth / 2 - 40 });
      if (data.customerPhone) {
        doc.text(data.customerPhone, marginLeft + 15, infoY + 60, { width: contentWidth / 2 - 40 });
      }

      // Caja info cancelación
      const cancelX = marginLeft + contentWidth / 2 + 10;
      doc.roundedRect(cancelX, infoY, contentWidth / 2 - 10, 90, 6).fill('#fef2f2');

      doc
        .fontSize(8).font('Helvetica-Bold').fillColor(COLORS.red)
        .text('MOTIVO DE CANCELACIÓN', cancelX + 15, infoY + 12);
      doc
        .fontSize(9).font('Helvetica').fillColor(COLORS.mediumGray)
        .text(data.cancellationReason, cancelX + 15, infoY + 28, { width: contentWidth / 2 - 40 });
      doc
        .fontSize(8).font('Helvetica-Bold').fillColor(COLORS.lightGray)
        .text('PEDIDO ORIGINAL', cancelX + 15, infoY + 58);
      doc
        .fontSize(9).font('Helvetica').fillColor(COLORS.mediumGray)
        .text(data.originalOrderDate, cancelX + 15, infoY + 72, { width: contentWidth / 2 - 40 });

      // ===== TABLA DE PRODUCTOS =====
      const tableTop = 245;
      doc.rect(marginLeft, tableTop, contentWidth, 28).fill(COLORS.darkGray);

      // Column positions - well-spaced
      const col1X = marginLeft + 8;
      const col2X = marginLeft + 58;
      const col3X = marginLeft + 280;
      const col4X = marginLeft + 325;
      const col5X = marginLeft + 410;

      doc
        .fontSize(7).font('Helvetica-Bold').fillColor(COLORS.white)
        .text('', col1X, tableTop + 9)
        .text('PRODUCTO', col2X, tableTop + 9)
        .text('CANT.', col3X, tableTop + 9, { width: 40, align: 'center' })
        .text('P.UNIT (sin IVA)', col4X, tableTop + 9, { width: 75, align: 'right' })
        .text('TOTAL (sin IVA)', col5X, tableTop + 9, { width: 75, align: 'right' });

      let itemY = tableTop + 35;
      let totalBaseImponible = 0;

      data.items.forEach((item, index) => {
        const unitBasePrice = getBasePrice(item.price);
        const lineTotal = unitBasePrice * item.quantity;
        totalBaseImponible += lineTotal;
        const rowHeight = 55;
        const isEven = index % 2 === 0;

        if (isEven) {
          doc.rect(marginLeft, itemY - 5, contentWidth, rowHeight).fill('#fafafa');
        }

        // Imagen del producto
        const imgBuf = imageBuffers[index];
        if (imgBuf) {
          try {
            doc.image(imgBuf, col1X, itemY, {
              width: 42,
              height: 42,
              fit: [42, 42],
            });
          } catch (e) {
            doc.roundedRect(col1X, itemY, 42, 42, 4).fill(COLORS.bgAccent);
            doc.fontSize(16).fillColor(COLORS.lightGray).text('👟', col1X + 10, itemY + 12);
          }
        } else {
          doc.roundedRect(col1X, itemY, 42, 42, 4).fill(COLORS.bgAccent);
          doc.fontSize(16).fillColor(COLORS.lightGray).text('👟', col1X + 10, itemY + 12);
        }

        // Nombre (tachado visual usando color gris)
        doc
          .fontSize(9).font('Helvetica-Bold').fillColor(COLORS.lightGray)
          .text(item.name, col2X, itemY + 5, { width: col3X - col2X - 10, height: 28 });

        if (item.size) {
          doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightGray)
            .text(`Talla: ${item.size}`, col2X, itemY + 22);
        }

        doc.fontSize(9).font('Helvetica').fillColor(COLORS.lightGray)
          .text(item.quantity.toString(), col3X, itemY + 14, { width: 40, align: 'center' })
          .text(formatEUR(unitBasePrice), col4X, itemY + 14, { width: 75, align: 'right' });

        doc.font('Helvetica-Bold').fillColor(COLORS.lightGray)
          .text(formatEUR(lineTotal), col5X, itemY + 14, { width: 75, align: 'right' });

        itemY += rowHeight;
      });

      // Separador
      doc.moveTo(marginLeft, itemY + 5)
        .lineTo(pageWidth - marginRight, itemY + 5)
        .strokeColor(COLORS.borderGray).lineWidth(1).stroke();

      // ===== RESUMEN DE REEMBOLSO CON IVA =====
      const totalIVA = Math.round(totalBaseImponible * IVA_RATE);
      const totalConIVA = totalBaseImponible + totalIVA;

      const summaryX = pageWidth - marginRight - 240;
      let summaryY = itemY + 18;

      // Base Imponible
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.lightGray)
        .text('Base Imponible:', summaryX, summaryY, { width: 140, align: 'right' });
      doc.text(formatEUR(totalBaseImponible), summaryX + 150, summaryY, { width: 90, align: 'right' });
      summaryY += 20;

      // IVA
      doc.text(`IVA (${(IVA_RATE * 100).toFixed(0)}%):`, summaryX, summaryY, { width: 140, align: 'right' });
      doc.text(formatEUR(totalIVA), summaryX + 150, summaryY, { width: 90, align: 'right' });
      summaryY += 20;

      // Total original tachado
      doc.text('Total original (IVA incl.):', summaryX, summaryY, { width: 140, align: 'right' });
      doc.text(formatEUR(totalConIVA), summaryX + 150, summaryY, { width: 90, align: 'right' });
      summaryY += 30;

      // REEMBOLSO DESTACADO
      doc.roundedRect(summaryX, summaryY, 240, 40, 6).fill(COLORS.green);
      doc
        .fontSize(12).font('Helvetica-Bold').fillColor(COLORS.white)
        .text('REEMBOLSO:', summaryX + 15, summaryY + 12, { width: 110 });
      doc
        .fontSize(18).fillColor(COLORS.white)
        .text(formatEUR(data.refundAmount), summaryX + 130, summaryY + 8, { width: 95, align: 'right' });

      // ===== NOTA FISCAL =====
      const noteY = summaryY + 52;
      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor(COLORS.lightGray)
        .text(
          'Esta factura rectificativa acredita la cancelación del pedido y el reembolso correspondiente. Los importes incluyen el desglose de IVA conforme a la legislación vigente.',
          marginLeft, noteY,
          { width: contentWidth, align: 'left' }
        );

      // ===== PIE DE PÁGINA =====
      const footerY = 720;
      doc.moveTo(marginLeft, footerY)
        .lineTo(pageWidth - marginRight, footerY)
        .strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();

      doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightGray)
        .text('Este documento acredita la cancelación de tu pedido y el reembolso correspondiente.',
          marginLeft, footerY + 12, { width: contentWidth, align: 'center' });
      doc.text('El reembolso se reflejará en tu método de pago original en 5-10 días hábiles.',
        marginLeft, footerY + 24, { width: contentWidth, align: 'center' });
      doc.fontSize(7).fillColor('#b0b0b0')
        .text(`Documento generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`,
          marginLeft, footerY + 42, { width: contentWidth, align: 'center' });

      // Barra inferior
      doc.rect(0, 800, pageWidth, 22).fill(COLORS.redDark);
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#ff9999')
        .text('KICKS', marginLeft, 804, { continued: true })
        .fillColor('#ffcccc')
        .text('PREMIUM', { continued: true })
        .fillColor('#ff9999')
        .font('Helvetica')
        .text('  •  Factura de Cancelación  •  kickspremium.victoriafp.online', { continued: false });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
