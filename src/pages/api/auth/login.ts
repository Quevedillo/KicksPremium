import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    // Validar datos
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email y password son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Iniciar sesión con Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!data.session) {
      return new Response(
        JSON.stringify({ error: 'No se pudo crear la sesión' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Guardar token en cookie (nombres que espera el middleware)
    cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: data.session.expires_in,
      path: '/',
    });

    // Guardar refresh token
    cookies.set('sb-refresh-token', data.session.refresh_token || '', {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sesión iniciada',
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Error en el servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
