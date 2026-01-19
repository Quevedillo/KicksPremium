import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { code, cartTotal } = body;

    if (!code) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Código requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener usuario si está autenticado
    let userId = null;
    const authHeader = request.headers.get('cookie');
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

    // Validar código usando la función de la BD
    const { data, error } = await supabase.rpc('validate_discount_code', {
      p_code: code.toString().toUpperCase(),
      p_user_id: userId,
      p_cart_total: cartTotal || 0,
    });

    if (error) {
      console.error('Error validating discount code:', error);
      return new Response(
        JSON.stringify({ valid: false, error: 'Error al validar el código' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in discount validation:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Error del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
