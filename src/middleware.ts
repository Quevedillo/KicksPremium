/**
 * Middleware de autenticación y autorización.
 * - Verifica tokens JWT reales con Supabase en rutas /admin y /api/admin
 * - Popula Astro.locals.user con los datos del usuario autenticado
 * - Añade headers de seguridad a todas las respuestas
 */
import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isLoginPage = pathname.includes("/auth/login");

  // Intentar extraer y verificar usuario desde cookies
  const accessToken = context.cookies.get("sb-access-token")?.value;
  const refreshToken = context.cookies.get("sb-refresh-token")?.value;

  if (accessToken && refreshToken && supabaseUrl) {
    try {
      // Crear cliente temporal para verificar el token
      const supabaseAuth = createClient(supabaseUrl, import.meta.env.PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });

      const { data: { user }, error } = await supabaseAuth.auth.getUser(accessToken);

      if (!error && user) {
        context.locals.user = {
          id: user.id,
          email: user.email ?? "",
          role: "authenticated",
        };
      }
    } catch {
      // Token inválido o expirado - no asignar usuario
    }
  }

  // Proteger rutas admin (páginas)
  if (isAdminPage && !isLoginPage) {
    if (!context.locals.user) {
      return context.redirect("/auth/login");
    }

    // Verificar rol admin en BD con service role
    if (supabaseServiceKey && supabaseUrl) {
      try {
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: profile } = await serviceClient
          .from("user_profiles")
          .select("is_admin")
          .eq("id", context.locals.user.id)
          .maybeSingle();

        const adminEmail = import.meta.env.ADMIN_EMAIL || import.meta.env.PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
        const isAdmin = profile?.is_admin === true ||
          (adminEmail && context.locals.user.email.toLowerCase() === adminEmail.toLowerCase());

        if (!isAdmin) {
          return context.redirect("/");
        }
      } catch {
        // Si falla la verificación, denegar acceso por seguridad
        return context.redirect("/auth/login");
      }
    }
  }

  // Proteger rutas API admin
  if (isAdminApi) {
    if (!context.locals.user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verificar admin para APIs
    if (supabaseServiceKey && supabaseUrl) {
      try {
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: profile } = await serviceClient
          .from("user_profiles")
          .select("is_admin")
          .eq("id", context.locals.user.id)
          .maybeSingle();

        const adminEmail = import.meta.env.ADMIN_EMAIL || import.meta.env.PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '';
        const isAdmin = profile?.is_admin === true ||
          (adminEmail && context.locals.user.email.toLowerCase() === adminEmail.toLowerCase());

        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Acceso denegado" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Error de autenticación" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  // Continuar con la request
  const response = await next();

  // Añadir headers de seguridad
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // No sobreescribir headers en endpoints que ya los definen (sitemap, robots, api)
  const isStaticAsset = pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?|xml|xsl|txt)$/);
  if (!pathname.startsWith("/api/") && !isStaticAsset) {
    // Evitar que el navegador cachee páginas que dependen de sesión
    // para que el estado de auth siempre esté actualizado
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
});
