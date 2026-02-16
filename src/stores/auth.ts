import { atom } from 'nanostores';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase';
import { clearCart } from './cart';

const ADMIN_EMAIL = import.meta.env.PUBLIC_ADMIN_EMAIL || '';

export interface AuthStore {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
}

export const authStore = atom<AuthStore>({
  user: null,
  isAdmin: false,
  isLoading: false,
  error: null,
  initialized: false,
});

let initPromise: Promise<void> | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;

/** Claves de localStorage que gestiona el módulo auth */
const AUTH_STORAGE_KEYS = ['auth_user', 'is_admin', 'sb-auth-token'] as const;

/**
 * Verifica si un usuario es admin.
 * Acepta un objeto User completo (con .id y .email).
 */
async function checkIsAdmin(user: User | null, retries = 3): Promise<boolean> {
  if (!user?.id) return false;

  // Verificación rápida por email
  if (ADMIN_EMAIL && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return true;
  }

  // Verificar en BD con reintentos
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        if (error.message?.includes('AbortError') || error.code === 'ABORT_ERR') {
          await new Promise(r => setTimeout(r, 200 * (i + 1)));
          continue;
        }
        if (error.code === 'PGRST116') return false;
        console.warn('[Auth] checkIsAdmin error:', error.message);
        return false;
      }

      return data?.is_admin === true;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      return false;
    }
  }
  return false;
}

function saveToStorage(user: User | null, isAdmin: boolean) {
  if (typeof window === 'undefined') return;
  
  if (user) {
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
  } else {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('is_admin');
  }
}

function loadFromStorage(): { user: User | null; isAdmin: boolean } {
  if (typeof window === 'undefined') return { user: null, isAdmin: false };
  
  try {
    const userStr = localStorage.getItem('auth_user');
    const isAdmin = localStorage.getItem('is_admin') === 'true';
    
    if (userStr) {
      return { user: JSON.parse(userStr), isAdmin };
    }
  } catch {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('is_admin');
  }
  
  return { user: null, isAdmin: false };
}

function clearAllCookies() {
  if (typeof document === 'undefined') return;
  
  document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  
  // Borrar todas las cookies de Supabase
  document.cookie.split(';').forEach(c => {
    const eqPos = c.indexOf('=');
    const name = eqPos > -1 ? c.substring(0, eqPos).trim() : c.trim();
    if (name.includes('sb-') || name.includes('supabase')) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    }
  });
}

export async function initializeAuth(): Promise<void> {
  const current = authStore.get();
  if (current.initialized) return;
  
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Cargar desde localStorage primero
      const stored = loadFromStorage();
      let userToCheck = null;
      
      if (stored.user) {
        userToCheck = stored.user;
      }

      // 2. Verificar sesión con Supabase
      let sessionUser = null;
      
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 3000)
        );
        
        const { data: sessionData } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        sessionUser = sessionData?.session?.user || null;
        
        if (sessionUser) {
          userToCheck = sessionUser;
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError' && !err?.message?.includes('timeout')) {
          console.warn('[Auth] Session check error:', err?.message);
        }
      }

      // 3. Verificar admin status para el usuario actual
      if (userToCheck) {
        const isAdmin = await checkIsAdmin(userToCheck);
        
        authStore.set({
          user: userToCheck,
          isAdmin,
          isLoading: false,
          error: null,
          initialized: true,
        });
        
        saveToStorage(userToCheck, isAdmin);
      } else {
        // No hay usuario
        authStore.set({
          user: null,
          isAdmin: false,
          isLoading: false,
          error: null,
          initialized: true,
        });
        saveToStorage(null, false);
      }

      // 4. Escuchar cambios de auth (SOLO para nuevos logins/logouts)
      try {
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const isAdmin = await checkIsAdmin(session.user);
            
            authStore.set({
              user: session.user,
              isAdmin,
              isLoading: false,
              error: null,
              initialized: true,
            });
            
            saveToStorage(session.user, isAdmin);
          } else if (event === 'SIGNED_OUT') {
            authStore.set({
              user: null,
              isAdmin: false,
              isLoading: false,
              error: null,
              initialized: true,
            });
            
            saveToStorage(null, false);
          }
        });

        authSubscription = data.subscription;
      } catch (err) {
        console.warn('[Auth] Error setting up listener:', err);
      }

    } catch (error) {
      console.error('[Auth] Init error:', error);
      
      // Usar localStorage como fallback
      const stored = loadFromStorage();
      authStore.set({
        user: stored.user,
        isAdmin: stored.isAdmin,
        isLoading: false,
        error: null,
        initialized: true,
      });
    }
  })();

  return initPromise;
}

export async function login(email: string, password: string) {
  authStore.set({
    ...authStore.get(),
    isLoading: true,
    error: null,
  });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user data');

    // Crear perfil SOLO si no existe
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || '',
          is_admin: data.user.email === ADMIN_EMAIL,
        });
    }

    const isAdmin = await checkIsAdmin(data.user);
    
    authStore.set({
      user: data.user,
      isAdmin,
      isLoading: false,
      error: null,
      initialized: true,
    });
    
    saveToStorage(data.user, isAdmin);

    return { success: true, user: data.user, isAdmin };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    authStore.set({
      ...authStore.get(),
      isLoading: false,
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function register(email: string, password: string, fullName: string) {
  authStore.set({
    ...authStore.get(),
    isLoading: true,
    error: null,
  });

  try {
    // Usar endpoint API en lugar de signUp directo para evitar problemas de email
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error al registrar');
    }

    // Después de registrar, hacer login automático
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) throw signInError;
    if (!signInData.user) throw new Error('No se pudo iniciar sesión');

    // Crear perfil SOLO si no existe
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', signInData.user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase
        .from('user_profiles')
        .insert({
          id: signInData.user.id,
          email: signInData.user.email,
          full_name: fullName,
          is_admin: signInData.user.email === ADMIN_EMAIL,
        });
    }

    const isAdmin = await checkIsAdmin(signInData.user);

    authStore.set({
      user: signInData.user,
      isAdmin,
      isLoading: false,
      error: null,
      initialized: true,
    });
    
    saveToStorage(signInData.user, isAdmin);

    return { success: true, user: signInData.user };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    authStore.set({
      ...authStore.get(),
      isLoading: false,
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function logout() {
  // Limpiar subscription inmediatamente
  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }

  // Limpiar carrito PRIMERO (antes de resetear estado)
  clearCart();

  // Limpiar estado
  authStore.set({
    user: null,
    isAdmin: false,
    isLoading: false,
    error: null,
    initialized: false,
  });

  // Limpiar claves de auth
  AUTH_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  
  // Limpiar carrito (PRIVADO POR USUARIO - no preservar entre sesiones)
  localStorage.removeItem('kickspremium-cart');
  
  // Limpiar también claves dinámicas de Supabase
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
      localStorage.removeItem(key);
    }
  }

  // Limpiar TODAS las cookies
  clearAllCookies();

  // Reset promise para forzar reinicialización
  initPromise = null;

  // Signout desde Supabase con scope local
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    console.warn('[Auth] signOut error:', err);
  }

  // Esperar un poco para asegurar limpieza completa
  await new Promise(r => setTimeout(r, 500));
  
  // Redirigir a home
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

export function getCurrentUser() {
  return authStore.get().user;
}

export function isAuthenticated() {
  return !!authStore.get().user;
}

export async function refreshAdminStatus() {
  const state = authStore.get();
  if (!state.user) return;

  const isAdmin = await checkIsAdmin(state.user);
  
  if (isAdmin !== state.isAdmin) {
    authStore.set({
      ...state,
      isAdmin,
    });
    saveToStorage(state.user, isAdmin);
  }
  
  return isAdmin;
}
