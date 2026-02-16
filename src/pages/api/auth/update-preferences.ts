import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

export const POST: APIRoute = async (context) => {
  const accessToken = context.cookies.get('sb-access-token')?.value;
  const refreshToken = context.cookies.get('sb-refresh-token')?.value;

  if (!accessToken || !refreshToken) {
    return new Response(
      JSON.stringify({ error: 'No autenticado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { data: sessionData } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (!sessionData?.user) {
      return new Response(
        JSON.stringify({ error: 'Sesión inválida' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { newsletter } = await context.request.json();

    if (typeof newsletter !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Valor inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (newsletter) {
      // Suscribir
      await supabase
        .from('newsletter_subscribers')
        .upsert(
          {
            email: sessionData.user.email,
            verified: true,
          },
          { onConflict: 'email' }
        );
    } else {
      // Desuscribir
      await supabase
        .from('newsletter_subscribers')
        .delete()
        .eq('email', sessionData.user.email);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
