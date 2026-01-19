// Middleware for authentication
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const isAdminRoute = context.url.pathname.startsWith("/admin");
  
  // Get tokens from cookies
  const accessToken = context.cookies.get('sb-access-token')?.value;
  const refreshToken = context.cookies.get('sb-refresh-token')?.value;

  if (isAdminRoute) {
    // Check if user is authenticated via cookies
    // NO usar Supabase aquí - causaría AbortError en SSR
    if (!accessToken || !refreshToken) {
      // Redirect to login if not authenticated
      if (!context.url.pathname.includes("/auth/login")) {
        return context.redirect("/auth/login");
      }
    } else {
      // Tokens existen, confiar en el cliente para verificar admin
      // El cliente verificará is_admin en auth.ts
    }
  }

  return next();
});
