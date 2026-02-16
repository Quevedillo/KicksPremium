import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Re-exportar tipos desde types.ts para mantener compatibilidad con imports existentes
export type { Category, Product, CartItem, Order, UserProfile, DiscountCode } from './types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Please check your .env file.'
  );
}

// Singleton cliente con configuración mejorada para evitar AbortError
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    // Server-side: crear nuevo cliente cada vez (no hay sesión que compartir)
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  
  // Client-side: usar singleton con configuración optimizada
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'sb-auth-token',
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

// Service role client singleton (solo server-side)
let serviceClientInstance: SupabaseClient | null = null;

/**
 * Cliente Supabase con service role key. Solo usar en API routes server-side.
 * Es singleton para evitar crear múltiples instancias.
 */
export const getSupabaseServiceClient = (): SupabaseClient => {
  if (serviceClientInstance) return serviceClientInstance;

  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables');
  }
  
  serviceClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return serviceClientInstance;
};
