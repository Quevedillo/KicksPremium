import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password, full_name } = await request.json();

    console.log('Register attempt:', { email, password: '***', full_name });

    // Validar datos
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email y password son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener las claves de las variables de entorno
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('Supabase config:', { supabaseUrl, serviceRoleKey: serviceRoleKey ? '***' : 'MISSING' });

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Configuración de servidor incompleta' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Crear usuario en auth.users
    console.log('Intentando crear usuario en Supabase...');
    
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // NO incluir user_metadata aquí para evitar triggers
    });

    if (error) {
      console.error('❌ Auth creation error:', error.message);
      
      // Detectar si es un error de usuario duplicado
      if (error.message.includes('duplicate') || error.message.includes('User already exists')) {
        console.log('📧 Usuario ya existe');
        return new Response(
          JSON.stringify({ error: 'Este email ya está registrado. Intenta con login.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: error.message || 'Error al crear usuario' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!data.user) {
      return new Response(
        JSON.stringify({ error: 'Error al crear usuario' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuario creado exitosamente:', data.user.id);

    // Actualizar metadata DESPUÉS de crear
    try {
      await adminClient.auth.admin.updateUserById(data.user.id, {
        user_metadata: {
          full_name: full_name || email.split('@')[0],
        },
      });
      console.log('Metadata actualizado');
    } catch (metadataError) {
      console.log('Warning: Could not update metadata:', metadataError);
    }

    // Crear perfil usando función SQL que bypassa RLS
    try {
      const { data: profileResult, error: rpcError } = await adminClient.rpc('create_user_profile', {
        p_user_id: data.user.id,
        p_email: data.user.email,
        p_full_name: full_name || email.split('@')[0],
        p_is_admin: false,
      });
      
      if (rpcError) {
        console.error('❌ Profile RPC error:', rpcError);
        // Para guest order linking, necesitamos el perfil, así que es crítico
        throw new Error(`Profile creation failed: ${rpcError.message}`);
      } else {
        console.log('✅ Profile created via RPC');
      }
    } catch (profileError) {
      console.error('🔴 Profile creation critical error:', profileError);
      // Intentar fallback directo
      try {
        const { error: insertError } = await adminClient.from('user_profiles').insert({
          id: data.user.id,
          email: data.user.email,
          full_name: full_name || email.split('@')[0],
          is_admin: false,
        });
        
        if (insertError) {
          console.error('🔴 Direct insert also failed:', insertError);
          return new Response(
            JSON.stringify({ error: `No se pudo crear el perfil: ${insertError.message}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        console.log('✅ Profile created with fallback direct insert');
      } catch (fallbackError) {
        console.error('🔴 Fallback also failed:', fallbackError);
        return new Response(
          JSON.stringify({ error: 'No se pudo crear el perfil de usuario' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Link any guest orders made with this email to the new user account
    try {
      const { data: linkResult, error: linkError } = await adminClient.rpc('link_guest_orders_to_user', {
        p_user_id: data.user.id,
        p_email: data.user.email,
      });
      
      if (linkError) {
        console.error('❌ Guest order linking error:', linkError);
        // No es crítico si falla - el usuario ya está registrado
      } else if (linkResult && linkResult > 0) {
        console.log(`✅ Linked ${linkResult} guest order(s) to new user ${data.user.email}`);
      } else {
        console.log('ℹ️  No guest orders to link for', data.user.email);
      }
    } catch (linkError) {
      console.error('❌ Guest order linking exception:', linkError);
      // Continuar aunque falle - no es crítico
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuario registrado exitosamente',
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Register error:', error);
    return new Response(
      JSON.stringify({ error: 'Error en el servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
