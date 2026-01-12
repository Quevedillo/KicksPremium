// Middleware for authentication
import { defineMiddleware } from "astro:middleware";
import { supabase } from "./lib/supabase";

export const onRequest = defineMiddleware(async (context, next) => {
  const isAdminRoute = context.url.pathname.startsWith("/admin");
  
  // Get tokens from cookies
  const accessToken = context.cookies.get('sb-access-token')?.value;
  const refreshToken = context.cookies.get('sb-refresh-token')?.value;

  if (isAdminRoute) {
    // Check if user is authenticated
    if (!accessToken || !refreshToken) {
      // Redirect to login if not authenticated
      if (!context.url.pathname.includes("/admin/login")) {
        return context.redirect("/admin/login");
      }
    } else {
      try {
        // Set session with tokens
        const { data: { user }, error: authError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (authError || !user) {
          context.cookies.delete('sb-access-token');
          context.cookies.delete('sb-refresh-token');
          return context.redirect("/admin/login");
        }

        // Store user in context for use in pages
        context.locals.user = user;

        // Verify user is admin (unless on login page)
        if (!context.url.pathname.includes("/admin/login")) {
          const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

          if (profileError || !userProfile?.is_admin) {
            // Redirect to home if not admin
            console.warn(`Access denied: User ${user.email} is not admin`);
            return context.redirect("/");
          }
        }
      } catch (err) {
        console.error('Middleware error:', err);
        context.cookies.delete('sb-access-token');
        context.cookies.delete('sb-refresh-token');
        return context.redirect("/admin/login");
      }
    }
  }

  return next();
});
