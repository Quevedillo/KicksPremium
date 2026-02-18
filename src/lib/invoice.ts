import PDFDocument from 'pdfkit';

export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
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
  subtotal: number;
  tax: number;
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
  if (isNaN(val)) return '€0.00';
  return `€${(val / 100).toFixed(2)}`;
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
 * Generar factura PDF premium
 * Retorna un Buffer con el contenido del PDF
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
      const statusColor = statusText === 'Completado' ? COLORS.green : statusText === 'Pendiente' ? COLORS.orange : COLORS.mediumGray;

      doc
        .roundedRect(marginLeft, statusY, 120, 24, 4)
        .fill(statusColor);

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text(statusText.toUpperCase(), marginLeft + 10, statusY + 7, { width: 100, align: 'center' });

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
        .text('CLIENTE', marginLeft + 15, infoY + 12);

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

      const col1X = marginLeft + 12; // Imagen
      const col2X = marginLeft + 72; // Producto
      const col3X = pageWidth - marginRight - 160; // Cant.
      const col4X = pageWidth - marginRight - 100; // Precio
      const col5X = pageWidth - marginRight - 10; // Total

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text('', col1X, tableTop + 9)
        .text('PRODUCTO', col2X, tableTop + 9)
        .text('CANT.', col3X, tableTop + 9, { width: 50, align: 'center' })
        .text('PRECIO', col4X, tableTop + 9, { width: 55, align: 'right' })
        .text('TOTAL', col5X - 55, tableTop + 9, { width: 55, align: 'right' });

      // Items
      let itemY = tableTop + 35;

      data.items.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
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
            // Placeholder si la imagen falla
            doc
              .roundedRect(col1X, itemY, 42, 42, 4)
              .fill(COLORS.bgAccent);
          }
        } else {
          doc
            .roundedRect(col1X, itemY, 42, 42, 4)
            .fill(COLORS.bgAccent);
        }

        // Nombre del producto
        doc
          .fontSize(10)
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
          .fontSize(10)
          .font('Helvetica')
          .fillColor(COLORS.mediumGray)
          .text(item.quantity.toString(), col3X, itemY + 12, { width: 50, align: 'center' });

        // Precio unitario
        doc
          .text(formatEUR(item.price), col4X, itemY + 12, { width: 55, align: 'right' });

        // Total de línea
        doc
          .font('Helvetica-Bold')
          .fillColor(COLORS.black)
          .text(formatEUR(itemTotal), col5X - 55, itemY + 12, { width: 55, align: 'right' });

        itemY += rowHeight;
      });

      // ===== LÍNEA SEPARADORA =====
      doc
        .moveTo(marginLeft, itemY + 5)
        .lineTo(pageWidth - marginRight, itemY + 5)
        .strokeColor(COLORS.borderGray)
        .lineWidth(1)
        .stroke();

      // ===== RESUMEN DE TOTALES =====
      const summaryX = pageWidth - marginRight - 200;
      let summaryY = itemY + 18;

      // Subtotal
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(COLORS.mediumGray)
        .text('Subtotal:', summaryX, summaryY, { width: 120, align: 'right' })
        .text(formatEUR(data.subtotal), summaryX + 125, summaryY, { width: 75, align: 'right' });

      summaryY += 20;

      // Descuento
      if (data.discount && data.discount > 0) {
        doc
          .fillColor(COLORS.green)
          .text('Descuento:', summaryX, summaryY, { width: 120, align: 'right' })
          .text(`-${formatEUR(data.discount)}`, summaryX + 125, summaryY, { width: 75, align: 'right' });
        summaryY += 20;
      }

      // IVA
      doc
        .fillColor(COLORS.mediumGray)
        .text('Impuestos (IVA):', summaryX, summaryY, { width: 120, align: 'right' })
        .text(formatEUR(data.tax), summaryX + 125, summaryY, { width: 75, align: 'right' });

      summaryY += 25;

      // ===== TOTAL DESTACADO =====
      doc
        .roundedRect(summaryX, summaryY, 200, 36, 6)
        .fill(COLORS.black);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(COLORS.white)
        .text('TOTAL:', summaryX + 15, summaryY + 10, { width: 80 });

      doc
        .fontSize(16)
        .fillColor(COLORS.red)
        .text(formatEUR(data.total), summaryX + 90, summaryY + 7, { width: 95, align: 'right' });

      // ===== PIE DE PÁGINA =====
      const footerY = 750;

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
          'Para consultas sobre tu pedido, visita kickspremium.com o contacta con nuestro equipo de soporte.',
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
        .rect(0, 820, pageWidth, 22)
        .fill(COLORS.black);

      doc
        .fontSize(7)
        .font('Helvetica-Bold')
        .fillColor('#999999')
        .text('KICKS', marginLeft, 824, { continued: true })
        .fillColor(COLORS.red)
        .text('PREMIUM', { continued: true })
        .fillColor('#666666')
        .font('Helvetica')
        .text('  •  kickspremium.com  •  Authentic Sneakers', { continued: false });

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
