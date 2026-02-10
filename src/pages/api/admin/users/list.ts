import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

export const GET: APIRoute = async (context) => {
  try {
    // Obtener todos los usuarios desde user_profiles
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, is_admin, is_active, created_at')
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
      is_active: user.is_active !== false,
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
