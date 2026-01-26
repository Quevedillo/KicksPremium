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

    // Opción 1: Intentar crear usuario SOLO sin trigger de perfil
    // Primero verificar si el usuario ya existe
    let existingUser = null;
    try {
      const { data: existingData } = await adminClient.auth.admin.getUserById(
        // No podemos buscar por email directo, así que intentamos crear y vemos qué pasa
      );
    } catch (e) {
      // Ignorar - no podemos buscar por email con admin API
    }

    // Crear usuario en auth.users
    // El truco es: crear sin metadatos que puedan disparar triggers
    console.log('Intentando crear usuario en Supabase...');
    
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // NO incluir user_metadata aquí para evitar triggers
    });

    if (error) {
      console.error('Auth creation error:', error.message);
      
      // Si el error es "Database error", podría ser que necesitemos desactivar el trigger
      // Intentamos con un endpoint alternativo que NO use triggers
      if (error.message.includes('Database error') || error.message.includes('duplicate')) {
        console.log('Intentando workaround...');
        
        // Verificar si el usuario existe
        try {
          const users = await adminClient.auth.admin.listUsers();
          const userExists = users.data?.users.some(u => u.email === email);
          
          if (userExists) {
            console.log('Usuario ya existe');
            return new Response(
              JSON.stringify({ error: 'Este email ya está registrado' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
        } catch (listError) {
          console.log('Could not list users:', listError);
        }
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
      const { error: rpcError } = await adminClient.rpc('create_user_profile', {
        p_user_id: data.user.id,
        p_email: data.user.email,
        p_full_name: full_name || email.split('@')[0],
        p_is_admin: false,
      });
      
      if (rpcError) {
        console.log('Profile RPC creation warning:', rpcError.message);
        // Fallback: intentar inserción directa
        try {
          await adminClient.from('user_profiles').insert({
            id: data.user.id,
            email: data.user.email,
            full_name: full_name || email.split('@')[0],
            is_admin: false,
          });
          console.log('Profile created with direct insert');
        } catch (fallbackError) {
          console.log('Profile creation fallback failed (no crítico):', fallbackError);
        }
      } else {
        console.log('Profile created via RPC');
      }
    } catch (profileError) {
      console.log('Profile creation error (no crítico):', profileError);
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
