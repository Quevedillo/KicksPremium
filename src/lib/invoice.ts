import PDFDocument from 'pdfkit';

export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  size?: string;
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
 * Generar factura PDF
 * Retorna un Buffer con el contenido del PDF
 */
export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Encabezado
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('KICKS PREMIUM', 50, 50, { width: 500 })
        .fontSize(10)
        .font('Helvetica')
        .text('Las mejores zapatillas exclusivas', 50, 85, { width: 500 });

      // Línea separadora
      doc
        .moveTo(50, 110)
        .lineTo(545, 110)
        .stroke();

      // Título y número de factura
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('FACTURA', 50, 130);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Número: ${data.invoiceNumber}`, 400, 130)
        .text(`Fecha: ${data.date}`, 400, 150)
        .text(`Estado: ${data.orderStatus}`, 400, 170);

      // Información del cliente
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('CLIENTE', 50, 220);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(data.customerName, 50, 240)
        .text(`Email: ${data.customerEmail}`, 50, 260);

      if (data.customerPhone) {
        doc.text(`Teléfono: ${data.customerPhone}`, 50, 280);
      }

      // Dirección de envío
      if (data.shippingAddress) {
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('DIRECCIÓN DE ENVÍO', 350, 220);

        doc
          .fontSize(10)
          .font('Helvetica')
          .text(data.shippingAddress.line1, 350, 240);

        if (data.shippingAddress.line2) {
          doc.text(data.shippingAddress.line2, 350, 260);
        }

        doc
          .text(
            `${data.shippingAddress.postal_code} ${data.shippingAddress.city}`,
            350,
            data.shippingAddress.line2 ? 280 : 260
          )
          .text(
            `${data.shippingAddress.state || ''} ${data.shippingAddress.country}`,
            350,
            data.shippingAddress.line2 ? 300 : 280
          );
      }

      // Tabla de productos
      const tableTop = 330;
      const col1X = 50;
      const col2X = 300;
      const col3X = 400;
      const col4X = 480;

      // Encabezados de tabla
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Producto', col1X, tableTop)
        .text('Cant.', col2X, tableTop)
        .text('Precio', col3X, tableTop)
        .text('Total', col4X, tableTop);

      // Línea bajo encabezado
      doc
        .moveTo(50, tableTop + 18)
        .lineTo(545, tableTop + 18)
        .stroke();

      // Items
      let itemY = tableTop + 30;
      let subtotalCalculated = 0;

      data.items.forEach((item) => {
        const itemTotal = item.price * item.quantity;
        subtotalCalculated += itemTotal;

        const productName = data.items.length > 3 ? `${item.name}${item.size ? ` (Talla ${item.size})` : ''}` : item.name;

        doc
          .fontSize(10)
          .font('Helvetica')
          .text(productName, col1X, itemY, { width: 240, height: 30 })
          .text(item.quantity.toString(), col2X, itemY, { width: 80, align: 'right' })
          .text(`€${(item.price / 100).toFixed(2)}`, col3X, itemY, { width: 70, align: 'right' })
          .text(`€${(itemTotal / 100).toFixed(2)}`, col4X, itemY, { width: 65, align: 'right' });

        itemY += 40;
      });

      // Línea separadora antes de totales
      doc
        .moveTo(50, itemY + 10)
        .lineTo(545, itemY + 10)
        .stroke();

      // Resumen de totales
      const summaryY = itemY + 25;

      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Subtotal:', 350, summaryY, { width: 130, align: 'right' })
        .text(`€${(data.subtotal / 100).toFixed(2)}`, 480, summaryY, { width: 65, align: 'right' });

      if (data.discount && data.discount > 0) {
        doc
          .text('Descuento:', 350, summaryY + 20, { width: 130, align: 'right' })
          .text(`-€${(data.discount / 100).toFixed(2)}`, 480, summaryY + 20, { width: 65, align: 'right' });
      }

      doc
        .text('Impuestos (IVA):', 350, summaryY + (data.discount && data.discount > 0 ? 40 : 20), {
          width: 130,
          align: 'right',
        })
        .text(
          `€${(data.tax / 100).toFixed(2)}`,
          480,
          summaryY + (data.discount && data.discount > 0 ? 40 : 20),
          { width: 65, align: 'right' }
        );

      // Total en grande
      const totalY = summaryY + (data.discount && data.discount > 0 ? 60 : 40);

      doc
        .fillColor('#EF4444')
        .rect(340, totalY, 205, 30)
        .fill();

      doc
        .fillColor('#FFF')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('TOTAL A PAGAR:', 350, totalY + 6, { width: 130, align: 'right' })
        .fontSize(16)
        .text(`€${(data.total / 100).toFixed(2)}`, 480, totalY + 2, { width: 65, align: 'right' });

      // Pie de página
      doc
        .fontSize(9)
        .fillColor('#666')
        .text(
          'Gracias por su compra en Kicks Premium. Para consultas, contáctenos a través de nuestro sitio web.',
          50,
          750,
          { width: 495, align: 'center' }
        );

      doc
        .fontSize(8)
        .fillColor('#999')
        .text(
          `Factura generada el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`,
          50,
          770,
          { width: 495, align: 'center' }
        );

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
  const timestamp = new Date().toISOString().split('T')[0];
  return `Factura_${invoiceNumber}_${timestamp}.pdf`;
}
