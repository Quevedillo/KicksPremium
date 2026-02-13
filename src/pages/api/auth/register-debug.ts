import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

/**
 * DEBUG ENDPOINT - Mismo flujo que /register pero con logs ultrad etallados
 * POST /api/auth/register-debug
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();
  const logs: string[] = [];
  
  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(msg);
  };

  try {
    const body = await request.json();
    const { email, password, full_name } = body;

    log(`1️⃣  INICIO: email=${email}, full_name=${full_name}, password_length=${password?.length || 0}`);

    // Validar datos
    if (!email || !password) {
      return new Response(
        JSON.stringify({ 
          error: 'Email y password son requeridos',
          logs,
          duration: Date.now() - startTime
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ 
          error: 'La contraseña debe tener al menos 6 caracteres',
          logs,
          duration: Date.now() - startTime
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    log(`2️⃣  CONFIG: supabaseUrl=${supabaseUrl}, serviceRoleKey=${serviceRoleKey ? 'SET' : 'MISSING'}`);

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Configuración de servidor incompleta',
          logs,
          duration: Date.now() - startTime
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    log(`3️⃣  Creando usuario en auth.users...`);
    
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      log(`❌ ERROR en createUser: ${error.message}`);
      
      // Intentar obtener info del usuario existente
      try {
        log(`4️⃣  Intentando listar usuarios...`);
        const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
        if (listError) {
          log(`❌ Error listando usuarios: ${listError.message}`);
        } else {
          const found = users?.users?.find(u => u.email === email);
          log(`📋 El usuario ${email} ${found ? 'YA EXISTE' : 'NO EXISTE'} en auth.users`);
        }
      } catch (e) {
        log(`❌ Exception checking users: ${e instanceof Error ? e.message : String(e)}`);
      }
      
      return new Response(
        JSON.stringify({ 
          error: error.message,
          logs,
          duration: Date.now() - startTime
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!data.user) {
      log(`❌ ERROR: createUser devolvió success pero sin user data`);
      return new Response(
        JSON.stringify({ 
          error: 'Error al crear usuario',
          logs,
          duration: Date.now() - startTime
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    log(`✅ Usuario creado: ${data.user.id}`);

    // Actualizar metadata
    log(`5️⃣  Actualizando metadata...`);
    try {
      await adminClient.auth.admin.updateUserById(data.user.id, {
        user_metadata: {
          full_name: full_name || email.split('@')[0],
        },
      });
      log(`✅ Metadata actualizado`);
    } catch (e) {
      log(`⚠️  Error en metadata (no crítico): ${e instanceof Error ? e.message : String(e)}`);
    }

    // Crear perfil
    log(`6️⃣  Llamando RPC create_user_profile...`);
    try {
      const { data: profileResult, error: rpcError } = await adminClient.rpc('create_user_profile', {
        p_user_id: data.user.id,
        p_email: data.user.email,
        p_full_name: full_name || email.split('@')[0],
        p_is_admin: false,
      });
      
      if (rpcError) {
        log(`❌ RPC error: ${JSON.stringify(rpcError)}`);
        
        log(`7️⃣  Intentando fallback: inserción directa en user_profiles...`);
        const { error: insertError } = await adminClient.from('user_profiles').insert({
          id: data.user.id,
          email: data.user.email,
          full_name: full_name || email.split('@')[0],
          is_admin: false,
        });
        
        if (insertError) {
          log(`❌ Insert error: ${JSON.stringify(insertError)}`);
          throw new Error(`${rpcError.message} | Insert fallback: ${insertError.message}`);
        }
        log(`✅ Perfil creado por insert directo`);
      } else {
        log(`✅ Perfil creado por RPC`);
      }
    } catch (profileError) {
      log(`❌ ERROR CRÍTICO en perfil: ${profileError instanceof Error ? profileError.message : String(profileError)}`);
      
      return new Response(
        JSON.stringify({ 
          error: `Error creando perfil: ${profileError instanceof Error ? profileError.message : String(profileError)}`,
          logs,
          duration: Date.now() - startTime
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Link guest orders
    log(`8️⃣  Llamando RPC link_guest_orders_to_user...`);
    try {
      const { data: linkResult, error: linkError } = await adminClient.rpc('link_guest_orders_to_user', {
        p_user_id: data.user.id,
        p_email: data.user.email,
      });
      
      if (linkError) {
        log(`⚠️  Linking error (no crítico): ${JSON.stringify(linkError)}`);
      } else if (linkResult && linkResult > 0) {
        log(`✅ Vinculados ${linkResult} pedidos de invitado`);
      } else {
        log(`ℹ️  No hay pedidos de invitado para vincular`);
      }
    } catch (linkError) {
      log(`⚠️  Linking exception (no crítico): ${linkError instanceof Error ? linkError.message : String(linkError)}`);
    }

    log(`🎉 ÉXITO en ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuario registrado exitosamente',
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        logs,
        duration: Date.now() - startTime
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log(`🔴 EXCEPCIÓN NO MANEJADA: ${error instanceof Error ? error.message : String(error)}`);
    log(`Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
    
    return new Response(
      JSON.stringify({ 
        error: 'Error en el servidor',
        logs,
        duration: Date.now() - startTime
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
