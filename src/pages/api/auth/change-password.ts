import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validaciones básicas
    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Contraseña actual y nueva son requeridas' }),
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }),
        { status: 400 }
      );
    }

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

    // Verificar contraseña actual intentando re-autenticar
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      return new Response(
        JSON.stringify({ error: 'La contraseña actual es incorrecta' }),
        { status: 400 }
      );
    }

    // Restaurar la sesión original después de verificar
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Actualizar contraseña
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar la contraseña' }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Contraseña actualizada correctamente' 
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Change password error:', error);
    return new Response(
      JSON.stringify({ error: 'Error del servidor' }),
      { status: 500 }
    );
  }
};
