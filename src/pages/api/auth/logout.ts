import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  try {
    // Borrar las cookies de sesión (nuevas)
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });
    
    // También borrar cookies antiguas por si acaso
    cookies.delete('auth-token', { path: '/' });
    cookies.delete('refresh-token', { path: '/' });
    cookies.delete('supabase-auth-token', { path: '/' });

    // Cerrar sesión en Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.warn('Warning: Supabase signOut returned error:', error);
    }

    // Redirigir al inicio
    return redirect('/');
  } catch (error) {
    console.error('Logout error:', error);
    // De todas formas redirigir al inicio incluso si hay error
    return redirect('/');
  }
};
