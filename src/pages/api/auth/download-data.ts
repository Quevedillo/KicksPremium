import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import PDFDocument from 'pdfkit';

export const GET: APIRoute = async ({ cookies }) => {
  try {
    // Obtener tokens de las cookies
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401 }
      );
    }

    // Establecer sesión
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError || !sessionData.user) {
      return new Response(
        JSON.stringify({ error: 'Sesión inválida' }),
        { status: 401 }
      );
    }

    const user = sessionData.user;

    // Obtener perfil
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Obtener pedidos
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Obtener suscripción newsletter
    const { data: newsletter } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .eq('email', user.email!)
      .single();

    // Generar PDF
    const pdfBuffer = await generateUserDataPDF({
      user,
      profile,
      orders: orders || [],
      newsletter,
    });

    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="MisDatos_KicksPremium.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Download data error:', error);
    return new Response(
      JSON.stringify({ error: 'Error del servidor' }),
      { status: 500 }
    );
  }
};

interface UserDataPDFInput {
  user: any;
  profile: any;
  orders: any[];
  newsletter: any;
}

function generateUserDataPDF(data: UserDataPDFInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { user, profile, orders, newsletter } = data;

      // ========== HEADER ==========
      doc.rect(0, 0, doc.page.width, 120).fill('#1a1a1a');
      
      doc.fontSize(28).fillColor('#ef4444').text('KICKS', 50, 35, { continued: true });
      doc.fillColor('#ffffff').text('PREMIUM');
      
      doc.fontSize(12).fillColor('#a3a3a3').text('Informe de Datos Personales', 50, 70);
      
      doc.fontSize(9).fillColor('#737373').text(
        `Generado el ${new Date().toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        50, 90
      );

      doc.moveDown(3);

      // ========== INFORMACIÓN PERSONAL ==========
      const sectionY = 140;
      
      doc.rect(50, sectionY, doc.page.width - 100, 30).fill('#dc2626');
      doc.fontSize(14).fillColor('#ffffff').text('INFORMACIÓN PERSONAL', 60, sectionY + 8);

      let y = sectionY + 45;

      const addField = (label: string, value: string) => {
        doc.fontSize(9).fillColor('#737373').text(label, 60, y);
        doc.fontSize(11).fillColor('#1a1a1a').text(value || 'No disponible', 200, y);
        y += 22;
      };

      addField('Email:', user.email || 'N/A');
      addField('Nombre:', profile?.full_name || 'No configurado');
      addField('ID de Usuario:', user.id);
      addField('Registro:', new Date(user.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }));
      addField('Último acceso:', user.last_sign_in_at 
        ? new Date(user.last_sign_in_at).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'N/A'
      );
      addField('Rol:', profile?.role || 'customer');
      addField('Newsletter:', newsletter ? 'Suscrito' : 'No suscrito');

      y += 15;

      // ========== PEDIDOS ==========
      doc.rect(50, y, doc.page.width - 100, 30).fill('#dc2626');
      doc.fontSize(14).fillColor('#ffffff').text(`HISTORIAL DE PEDIDOS (${orders.length})`, 60, y + 8);
      y += 45;

      if (orders.length === 0) {
        doc.fontSize(11).fillColor('#737373').text('No tienes pedidos registrados.', 60, y);
        y += 30;
      } else {
        // Table header
        doc.fontSize(8).fillColor('#737373');
        doc.text('FECHA', 60, y);
        doc.text('ESTADO', 180, y);
        doc.text('PRODUCTOS', 270, y);
        doc.text('TOTAL', 450, y);
        y += 5;
        
        doc.moveTo(60, y + 10).lineTo(doc.page.width - 50, y + 10).strokeColor('#e5e5e5').stroke();
        y += 18;

        for (const order of orders.slice(0, 20)) {
          // Check if we need a new page
          if (y > doc.page.height - 80) {
            doc.addPage();
            y = 50;
          }

          const date = new Date(order.created_at).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });

          const statusLabels: Record<string, string> = {
            pending: 'Pendiente',
            paid: 'Pagado',
            processing: 'Procesando',
            shipped: 'Enviado',
            delivered: 'Entregado',
            completed: 'Completado',
            failed: 'Fallido',
            cancelled: 'Cancelado',
            refunded: 'Reembolsado',
          };

          const items = Array.isArray(order.items) ? order.items : [];
          const itemCount = items.reduce((sum: number, item: any) => sum + (item.qty || item.quantity || 1), 0);
          const total = ((order.total_amount || 0) / 100).toFixed(2);

          doc.fontSize(9).fillColor('#1a1a1a');
          doc.text(date, 60, y);
          doc.text(statusLabels[order.status] || order.status, 180, y);
          doc.text(`${itemCount} producto(s)`, 270, y);
          doc.text(`${total} EUR`, 450, y);

          // List product names
          if (items.length > 0) {
            y += 14;
            for (const item of items.slice(0, 5)) {
              const name = item.name || 'Producto';
              const size = item.size ? ` (Talla: ${item.size})` : '';
              const qty = item.qty || item.quantity || 1;
              doc.fontSize(8).fillColor('#737373')
                .text(`  • ${name}${size} x${qty}`, 70, y);
              y += 12;
            }
            if (items.length > 5) {
              doc.fontSize(8).fillColor('#737373').text(`  ... y ${items.length - 5} más`, 70, y);
              y += 12;
            }
          }

          y += 4;
          doc.moveTo(60, y).lineTo(doc.page.width - 50, y).strokeColor('#f5f5f5').stroke();
          y += 10;
        }

        if (orders.length > 20) {
          doc.fontSize(9).fillColor('#737373').text(
            `Se muestran los primeros 20 pedidos de ${orders.length} totales.`,
            60, y
          );
          y += 25;
        }
      }

      // ========== RESUMEN ==========
      if (y > doc.page.height - 150) {
        doc.addPage();
        y = 50;
      }

      y += 10;
      doc.rect(50, y, doc.page.width - 100, 30).fill('#dc2626');
      doc.fontSize(14).fillColor('#ffffff').text('RESUMEN DE ACTIVIDAD', 60, y + 8);
      y += 45;

      const totalSpent = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / 100;
      const completedOrders = orders.filter(o => ['paid', 'completed', 'shipped'].includes(o.status)).length;

      addField('Total gastado:', `${totalSpent.toFixed(2)} EUR`);
      addField('Pedidos completados:', `${completedOrders}`);
      addField('Pedidos en proceso:', `${orders.filter(o => o.status === 'processing').length}`);
      addField('Pedidos cancelados:', `${orders.filter(o => o.status === 'cancelled').length}`);

      // ========== FOOTER ==========
      y += 30;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#e5e5e5').stroke();
      y += 15;

      doc.fontSize(8).fillColor('#a3a3a3');
      doc.text(
        'Este documento contiene todos los datos personales almacenados en KicksPremium asociados a tu cuenta.',
        50, y, { width: doc.page.width - 100, align: 'center' }
      );
      y += 20;
      doc.text(
        'En cumplimiento con el RGPD, tienes derecho a solicitar la eliminación de estos datos.',
        50, y, { width: doc.page.width - 100, align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
