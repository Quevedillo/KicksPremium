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

// Función simple para verificar admin - con retry
async function checkIsAdmin(userId: string, retries = 3): Promise<boolean> {
  console.log('[checkIsAdmin] Starting check for user:', userId);
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[checkIsAdmin] Attempt ${i + 1}/${retries}`);
      
      const { data, error, status, statusText } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

      console.log('[checkIsAdmin] Response:', { data, error, status, statusText });

      if (error) {
        // Si es AbortError, reintentar
        if (error.message?.includes('AbortError') || error.code === 'ABORT_ERR') {
          console.log(`[checkIsAdmin] AbortError, retrying...`);
          await new Promise(r => setTimeout(r, 200 * (i + 1)));
          continue;
        }
        // Si es error de RLS (no rows), el perfil no existe
        if (error.code === 'PGRST116') {
          console.log('[checkIsAdmin] No profile found (PGRST116)');
          return false;
        }
        console.warn('[checkIsAdmin] Error:', error);
        return false;
      }

      const result = data?.is_admin === true;
      console.log('[checkIsAdmin] Final result:', result);
      return result;
    } catch (err) {
      console.warn('[checkIsAdmin] Exception on attempt', i + 1, ':', err);
      // Si es AbortError, reintentar
      if (err instanceof Error && err.name === 'AbortError') {
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      return false;
    }
  }
  console.log('[checkIsAdmin] All retries exhausted');
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

export async function initializeAuth(): Promise<void> {
  const current = authStore.get();
  if (current.initialized) return;
  
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Cargar desde localStorage primero (instantáneo)
      const stored = loadFromStorage();
      
      if (stored.user) {
        authStore.set({
          user: stored.user,
          isAdmin: stored.isAdmin,
          isLoading: false,
          error: null,
          initialized: true,
        });
      }

      // 2. Verificar sesión con Supabase
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData?.session?.user) {
        const user = sessionData.session.user;
        
        // 3. Verificar si es admin
        const isAdmin = await checkIsAdmin(user.id);
        
        authStore.set({
          user,
          isAdmin,
          isLoading: false,
          error: null,
          initialized: true,
        });
        
        saveToStorage(user, isAdmin);
      } else if (!stored.user) {
        // No hay sesión ni localStorage
        authStore.set({
          user: null,
          isAdmin: false,
          isLoading: false,
          error: null,
          initialized: true,
        });
        saveToStorage(null, false);
      }

      // 4. Escuchar cambios de auth
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event);
        
        if (session?.user) {
          const isAdmin = await checkIsAdmin(session.user.id);
          
          authStore.set({
            user: session.user,
            isAdmin,
            isLoading: false,
            error: null,
            initialized: true,
          });
          
          saveToStorage(session.user, isAdmin);
        } else {
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

    // Crear perfil SOLO si no existe (no sobreescribir is_admin)
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', data.user.id)
      .single();

    if (!existingProfile) {
      // Solo insertar si no existe
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned');

    // Crear perfil SOLO si no existe
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', data.user.id)
      .single();

    if (!existingProfile) {
      await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          full_name: fullName,
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
  // Limpiar subscription
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

  saveToStorage(null, false);
  initPromise = null;

  try {
    await supabase.auth.signOut();
  } catch {}

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

// Función para refrescar el estado de admin manualmente
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
