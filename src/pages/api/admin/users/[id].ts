import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Helper: obtener cliente con service role
const getServiceRoleClient = () => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

// Helper: verificar autenticación y permisos de admin
const verifyAdminAuth = async (
  accessToken: string | undefined,
  refreshToken: string | undefined
) => {
  if (!accessToken || !refreshToken) {
    return { error: 'No autorizado', status: 401, user: null };
  }

  const { data: { user }, error: authError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (authError || !user) {
    return { error: 'Sesión inválida', status: 401, user: null };
  }

  const { data: adminProfile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminProfile?.is_admin) {
    return { error: 'No tienes permisos de administrador', status: 403, user: null };
  }

  return { error: null, status: 200, user };
};

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    // Verificar autenticación y permisos
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    const authResult = await verifyAdminAuth(accessToken, refreshToken);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = authResult.user!;

    const userId = params.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'ID de usuario requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Evitar que un admin se quite permisos a sí mismo
    const body = await request.json();
    
    if (userId === user.id && body.is_admin === false) {
      return new Response(JSON.stringify({ error: 'No puedes quitarte permisos de admin a ti mismo' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Construir objeto de actualización
    const updateData: Record<string, unknown> = {};
    
    if (typeof body.is_admin === 'boolean') {
      updateData.is_admin = body.is_admin;
    }

    if (typeof body.is_active === 'boolean') {
      updateData.is_active = body.is_active;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ error: 'No hay datos para actualizar' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Actualizar perfil
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return new Response(JSON.stringify({ error: 'Error al actualizar usuario' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, user: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en PATCH /api/admin/users/[id]:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    // Verificar autenticación y permisos
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    const authResult = await verifyAdminAuth(accessToken, refreshToken);
    if (authResult.error) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = authResult.user!;

    const userId = params.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'ID de usuario requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Evitar que un admin se borre a sí mismo
    if (userId === user.id) {
      return new Response(JSON.stringify({ error: 'No puedes borrar tu propia cuenta' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener cliente con service role para eliminar de auth.users
    const adminClient = getServiceRoleClient();

    // Primero eliminar de user_profiles (que tiene cascadas configuradas)
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting user_profiles:', profileError);
      return new Response(JSON.stringify({ error: 'Error al eliminar perfil de usuario' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Luego eliminar de auth.users usando service role
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting auth user:', authError);
      // Si falla aquí pero se eliminó de profiles, seguir adelante
      console.warn(`Usuario ${userId} eliminado de perfiles pero hubo error en auth`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Usuario eliminado correctamente' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en DELETE /api/admin/users/[id]:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
