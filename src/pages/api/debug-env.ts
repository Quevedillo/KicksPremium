import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

/**
 * Endpoint temporal de diagnóstico - ELIMINAR DESPUÉS DE RESOLVER EL PROBLEMA
 * Muestra el estado de las variables de entorno y la verificación de admin
 */
export const GET: APIRoute = async (context) => {
  // Obtener token
  const authHeader = context.request.headers.get('Authorization');
  let accessToken = authHeader?.replace('Bearer ', '');
  if (!accessToken) {
    accessToken = context.cookies.get('sb-access-token')?.value;
  }

  const env = {
    PUBLIC_SUPABASE_URL: !!import.meta.env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    PUBLIC_ADMIN_EMAIL: import.meta.env.PUBLIC_ADMIN_EMAIL || '(vacío)',
    ADMIN_EMAIL_importmeta: import.meta.env.ADMIN_EMAIL || '(vacío)',
    ADMIN_EMAIL_process: process.env.ADMIN_EMAIL || '(vacío)',
    SUPABASE_SERVICE_ROLE_KEY: !!import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY_process: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAccessToken: !!accessToken,
    tokenSource: authHeader ? 'header' : accessToken ? 'cookie' : 'ninguno',
  };

  let userInfo: any = { checked: false };
  let profileInfo: any = { checked: false };

  if (accessToken) {
    try {
      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const authClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: { user }, error } = await authClient.auth.getUser(accessToken);
        userInfo = {
          checked: true,
          found: !!user,
          id: user?.id,
          email: user?.email,
          error: error?.message,
        };

        // Check profile with service role
        const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (user && serviceKey) {
          const serviceClient = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          });

          const { data: profile, error: profileError } = await serviceClient
            .from('user_profiles')
            .select('id, email, is_admin')
            .eq('id', user.id)
            .maybeSingle();

          profileInfo = {
            checked: true,
            found: !!profile,
            is_admin: profile?.is_admin,
            email: profile?.email,
            error: profileError?.message,
          };
        } else {
          profileInfo = { checked: false, reason: serviceKey ? 'no user' : 'no service key' };
        }
      }
    } catch (err: any) {
      userInfo = { checked: true, error: err?.message };
    }
  }

  return new Response(
    JSON.stringify({ env, user: userInfo, profile: profileInfo }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
