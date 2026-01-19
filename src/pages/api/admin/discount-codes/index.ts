import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

// GET - Listar todos los códigos
export const GET: APIRoute = async ({ cookies }) => {
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

    const { data: codes, error } = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify(codes), { status: 200 });
  } catch (error) {
    console.error('Error fetching discount codes:', error);
    return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
  }
};

// POST - Crear nuevo código
export const POST: APIRoute = async ({ request, cookies }) => {
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

    const body = await request.json();
    const {
      code,
      description,
      discount_type,
      discount_value,
      min_purchase,
      max_uses,
      max_uses_per_user,
      expires_at,
    } = body;

    if (!code || !discount_value) {
      return new Response(
        JSON.stringify({ error: 'Código y valor de descuento son requeridos' }),
        { status: 400 }
      );
    }

    const { data: newCode, error } = await supabase
      .from('discount_codes')
      .insert({
        code: code.toUpperCase(),
        description,
        discount_type: discount_type || 'percentage',
        discount_value,
        min_purchase: min_purchase || 0,
        max_uses: max_uses || null,
        max_uses_per_user: max_uses_per_user || 1,
        expires_at: expires_at || null,
        created_by: sessionData.user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Ya existe un código con ese nombre' }),
          { status: 400 }
        );
      }
      throw error;
    }

    return new Response(JSON.stringify(newCode), { status: 201 });
  } catch (error) {
    console.error('Error creating discount code:', error);
    return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
  }
};
