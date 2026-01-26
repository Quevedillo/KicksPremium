import { atom } from 'nanostores';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase';

const ADMIN_EMAIL = import.meta.env.PUBLIC_ADMIN_EMAIL || 'joseluisgq17@gmail.com';

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

// Función simple para verificar admin
async function checkIsAdmin(user: any, retries = 3): Promise<boolean> {
  console.log('[checkIsAdmin] Starting check:', {
    userId: user?.id,
    userEmail: user?.email,
    ADMIN_EMAIL,
    emailMatch: user?.email === ADMIN_EMAIL,
    emailLowerMatch: user?.email?.toLowerCase() === ADMIN_EMAIL?.toLowerCase()
  });
  
  // Primero: verificar por email (fallback rápido)
  if (user?.email === ADMIN_EMAIL) {
    console.log('[checkIsAdmin] ✅ Admin confirmed by exact email match');
    return true;
  }
  
  // Case-insensitive check
  if (user?.email?.toLowerCase() === ADMIN_EMAIL?.toLowerCase()) {
    console.log('[checkIsAdmin] ✅ Admin confirmed by case-insensitive email match');
    return true;
  }
  
  // Segundo: verificar en BD (con reintentos)
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[checkIsAdmin] Attempt ${i + 1}/${retries}`);
      
      const { data, error, status, statusText } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();

      console.log('[checkIsAdmin] Response:', { data, error, status, statusText });

      if (error) {
        if (error.message?.includes('AbortError') || error.code === 'ABORT_ERR') {
          console.log(`[checkIsAdmin] AbortError, retrying...`);
          await new Promise(r => setTimeout(r, 200 * (i + 1)));
          continue;
        }
        if (error.code === 'PGRST116') {
          console.log('[checkIsAdmin] No profile found (PGRST116)');
          return false;
        }
        console.warn('[checkIsAdmin] Error:', error);
        return false;
      }

      const result = data?.is_admin === true;
      console.log('[checkIsAdmin] Final result from BD:', result);
      return result;
    } catch (err) {
      console.warn('[checkIsAdmin] Exception on attempt', i + 1, ':', err);
      if (err instanceof Error && err.name === 'AbortError') {
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      return false;
    }
  }
  console.log('[checkIsAdmin] ❌ All retries exhausted, returning false');
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
    const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
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
        console.log('[Auth] User from storage:', stored.user.email);
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
        console.log('[Auth] Session user:', sessionUser?.email);
        
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
        console.log('[Auth] Checking admin status for:', userToCheck.email);
        const isAdmin = await checkIsAdmin(userToCheck);
        console.log('[Auth] User is admin:', isAdmin);
        
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
          console.log('[Auth] State change:', event);
          
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
  console.log('[Auth] Login attempt for:', email);
  
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

    const isAdmin = await checkIsAdmin(data.user.id);
    
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
    console.error('[Auth] Login error:', message);
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

    const isAdmin = await checkIsAdmin(signInData.user.id);

    authStore.set({
      user: signInData.user,
      isAdmin,
      isLoading: false,
      error: null,
      initialized: true,
    });
    
    saveToStorage(signInData.user, isAdmin);

    return { success: true, user: data.user };
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
  console.log('[Auth] Starting logout...');
  
  // Limpiar subscription inmediatamente
  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }

  // Limpiar estado
  authStore.set({
    user: null,
    isAdmin: false,
    isLoading: false,
    error: null,
    initialized: false,
  });

  // Limpiar storage
  localStorage.clear();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
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

  const isAdmin = await checkIsAdmin(state.user.id);
  
  if (isAdmin !== state.isAdmin) {
    authStore.set({
      ...state,
      isAdmin,
    });
    saveToStorage(state.user, isAdmin);
  }
  
  return isAdmin;
}
