import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Cliente con service role para acceder sin restricciones RLS
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

export const GET: APIRoute = async (context) => {
  try {
    // Obtener token del usuario autenticado
    const accessToken = context.cookies.get('sb-access-token')?.value;
    const refreshToken = context.cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(
        JSON.stringify({ 
          users: [],
          error: 'No autorizado' 
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verificar sesión del usuario
    const { data: { user }, error: authError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          users: [],
          error: 'Sesión inválida' 
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verificar que el usuario sea admin (usando cliente normal)
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile?.is_admin) {
      return new Response(
        JSON.stringify({ 
          users: [],
          error: 'No tienes permisos de administrador' 
        }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Usar service role para obtener todos los usuarios (sin restricciones RLS)
    const adminClient = getServiceRoleClient();
    const { data: users, error } = await adminClient
      .from('user_profiles')
      .select('id, full_name, email, is_admin, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API] Error fetching users:', error);
      return new Response(
        JSON.stringify({ 
          users: [],
          error: 'Error al obtener usuarios: ' + error.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const usersWithDefaults = (users || []).map(user => ({
      ...user,
      email: user.email || (user.full_name ? `${user.full_name.toLowerCase().replace(/\s+/g, '.')}@cliente` : `${user.id.slice(0, 8)}@usuario`),
      is_active: true, // Todos los usuarios están activos por defecto
    }));

    return new Response(
      JSON.stringify({ 
        users: usersWithDefaults,
        count: usersWithDefaults.length
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[API] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        users: [],
        error: 'Error inesperado' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
