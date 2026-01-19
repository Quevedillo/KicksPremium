import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import { sendReturnRequestEmail } from '@lib/email';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { orderId, reason } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID de pedido requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener usuario autenticado
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError || !sessionData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sesión inválida' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = sessionData.user.id;

    // Llamar a la función de solicitud de devolución
    const { data, error } = await supabase.rpc('request_return', {
      p_order_id: orderId,
      p_user_id: userId,
      p_reason: reason || 'Solicitud de devolución del cliente',
    });

    if (error) {
      console.error('Error requesting return:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al solicitar la devolución' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar resultado de la función
    if (!data?.success) {
      return new Response(
        JSON.stringify({ success: false, error: data?.error || 'No se pudo solicitar la devolución' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener detalles del pedido para el email
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    // Enviar email con instrucciones de devolución
    if (order && sessionData.user.email) {
      try {
        await sendReturnRequestEmail({
          orderId: order.id,
          email: sessionData.user.email,
          customerName: order.customer_name || 'Cliente',
          items: order.items,
          returnAddress: {
            name: 'KicksPremium - Devoluciones',
            line1: 'Calle Principal 123',
            city: 'Madrid',
            postalCode: '28001',
            country: 'España',
          },
        });
      } catch (emailError) {
        console.error('Error sending return email:', emailError);
        // No fallar si el email falla
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Solicitud de devolución registrada. Revisa tu email para las instrucciones.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in return request:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
