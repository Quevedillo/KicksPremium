import type { APIRoute } from 'astro';
import { getCloudinary } from '@lib/cloudinary';
import { supabase } from '@lib/supabase';

export const POST: APIRoute = async (context) => {
  try {
    // Validar que sea una solicitud POST con FormData
    if (context.request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener tokens de sesión
    const accessToken = context.cookies.get('sb-access-token')?.value;
    const refreshToken = context.cookies.get('sb-refresh-token')?.value;

    console.log('[Upload] Tokens disponibles:', { 
      hasAccessToken: !!accessToken, 
      hasRefreshToken: !!refreshToken 
    });

    if (!accessToken || !refreshToken) {
      console.error('[Upload] Error: No hay tokens de sesión');
      return new Response(
        JSON.stringify({ error: 'No autenticado - Por favor inicia sesión' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar sesión
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    console.log('[Upload] Sesión validada:', { 
      userId: sessionData?.user?.id,
      error: sessionError?.message 
    });

    if (!sessionData?.user) {
      console.error('[Upload] Error: Sesión inválida', sessionError);
      return new Response(
        JSON.stringify({ error: 'Sesión inválida - Por favor inicia sesión de nuevo' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que sea admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', sessionData.user.id)
      .single();

    console.log('[Upload] Perfil verificado:', { 
      userId: sessionData.user.id,
      isAdmin: profile?.is_admin,
      error: profileError?.message 
    });

    if (profileError) {
      console.error('[Upload] Error al obtener perfil:', profileError);
      return new Response(
        JSON.stringify({ error: 'Error al verificar permisos' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!profile?.is_admin) {
      console.warn('[Upload] Acceso denegado: usuario no es admin', sessionData.user.id);
      return new Response(
        JSON.stringify({ error: 'No autorizado: solo administradores pueden subir imágenes' }),
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
