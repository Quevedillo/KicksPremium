import type { APIRoute } from 'astro';
import { getCloudinary } from '@lib/cloudinary';
import { getSupabaseServiceClient } from '@lib/supabase';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async (context) => {
  try {
    // Validar que sea una solicitud POST con FormData
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener token de sesión - primero de header, luego de cookies
    const authHeader = context.request.headers.get('Authorization');
    let accessToken = authHeader?.replace('Bearer ', '');
    
    // Fallback a cookies si no hay header
    if (!accessToken) {
      accessToken = context.cookies.get('sb-access-token')?.value;
    }

    console.log('[Upload] Token disponible:', { 
      hasAccessToken: !!accessToken,
      source: authHeader ? 'header' : 'cookie'
    });

    if (!accessToken) {
      console.error('[Upload] Error: No hay token de sesión');
      return new Response(
        JSON.stringify({ error: 'No autenticado - Por favor inicia sesión' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar sesión usando cliente temporal con anon key
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken);

    console.log('[Upload] Usuario verificado:', { 
      userId: user?.id,
      error: userError?.message 
    });

    if (!user || userError) {
      console.error('[Upload] Error: Token inválido', userError);
      return new Response(
        JSON.stringify({ error: 'Sesión inválida - Por favor inicia sesión de nuevo' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que sea admin usando service role (bypass RLS)
    let serviceClient;
    try {
      serviceClient = getSupabaseServiceClient();
    } catch (serviceError) {
      console.error('[Upload] Error al obtener service client:', serviceError);
      return new Response(
        JSON.stringify({ 
          error: 'Error de configuración del servidor',
          debug: 'SUPABASE_SERVICE_ROLE_KEY no configurada'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await serviceClient
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    // También verificar si es el email admin de la configuración
    const adminEmail = import.meta.env.PUBLIC_ADMIN_EMAIL;
    const isAdmin = profile?.is_admin === true || 
      (adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase());

    console.log('[Upload] Perfil verificado:', { 
      userId: user.id,
      email: user.email,
      isAdmin: isAdmin,
      profileIsAdmin: profile?.is_admin,
      adminEmailEnv: adminEmail,
      profileFound: !!profile,
      error: profileError?.message 
    });

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[Upload] Error al obtener perfil:', profileError);
      return new Response(
        JSON.stringify({ error: 'Error al verificar permisos' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin) {
      console.warn('[Upload] Acceso denegado: usuario no es admin', {
        userId: user.id,
        email: user.email,
        profileIsAdmin: profile?.is_admin,
        adminEmailEnv: adminEmail ? '(configurado)' : '(no configurado)'
      });
      return new Response(
        JSON.stringify({ 
          error: 'No autorizado: solo administradores pueden subir imágenes',
          debug: {
            userEmail: user.email,
            profileFound: !!profile,
            profileIsAdmin: profile?.is_admin,
            adminEmailConfigured: !!adminEmail
          }
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener el FormData
    const formData = await context.request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('[Upload] Error: No file provided');
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Upload] Archivo recibido:', { name: file.name, size: file.size, type: file.type });

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      console.error('[Upload] Tipo de archivo inválido:', file.type);
      return new Response(
        JSON.stringify({
          error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar tamaño (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.error('[Upload] Archivo demasiado grande:', file.size);
      return new Response(
        JSON.stringify({ error: 'File size must be less than 10MB' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convertir file a buffer
    const buffer = await file.arrayBuffer();

    console.log('[Upload] Subiendo a Cloudinary...');

    // Subir a Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = getCloudinary().uploader.upload_stream(
        {
          folder: 'tienda-online/productos',
          resource_type: 'auto',
          quality: 'auto',
          fetch_format: 'auto',
        },
        (error, result) => {
          if (error) {
            console.error('[Upload] Error en Cloudinary:', error);
            reject(error);
          } else {
            console.log('[Upload] Éxito en Cloudinary:', result?.public_id);
            resolve(result);
          }
        }
      );

      uploadStream.end(Buffer.from(buffer));
    });

    return new Response(
      JSON.stringify({
        success: true,
        publicId: (result as any).public_id,
        url: (result as any).secure_url,
        width: (result as any).width,
        height: (result as any).height,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    } catch (error) {
      console.error('[Upload] Error general:', error);
      return new Response(
        JSON.stringify({ error: 'Error al subir imagen' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
