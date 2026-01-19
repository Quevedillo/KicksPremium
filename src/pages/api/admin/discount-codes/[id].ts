import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

// PATCH - Actualizar código
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
    }

    const { data: sessionData } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (!sessionData?.user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401 });
    }

    // Verificar admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', sessionData.user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }

    const { id } = params;
    const body = await request.json();

    const { data: updatedCode, error } = await supabase
      .from('discount_codes')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(updatedCode), { status: 200 });
  } catch (error) {
    console.error('Error updating discount code:', error);
    return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
  }
};

// DELETE - Eliminar código
export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
    }

    const { data: sessionData } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (!sessionData?.user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401 });
    }

    // Verificar admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', sessionData.user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403 });
    }

    const { id } = params;

    const { error } = await supabase
      .from('discount_codes')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error deleting discount code:', error);
    return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
  }
};
