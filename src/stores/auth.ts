import { atom } from 'nanostores';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase';

export interface AuthStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
}

export const authStore = atom<AuthStore>({
  user: null,
  isLoading: true,
  error: null,
  initialized: false,
});

// Initialize auth state from session
export async function initializeAuth() {
  // Evitar múltiples inicializaciones
  const current = authStore.get();
  if (current.initialized) return;

  try {
    // Primero intentar recuperar sesión de Supabase
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Error getting session:', sessionError);
      // Si hay error, limpiar todo
      localStorage.removeItem('auth_user');
      authStore.set({
        user: null,
        isLoading: false,
        error: null,
        initialized: true,
      });
      return;
    }

    // Si hay sesión válida, usarla
    if (session?.user) {
      authStore.set({
        user: session.user,
        isLoading: false,
        error: null,
        initialized: true,
      });
      localStorage.setItem('auth_user', JSON.stringify(session.user));
      
      // Save tokens as cookies for SSR
      if (session.access_token) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=3600; SameSite=Lax`;
      }
      if (session.refresh_token) {
        document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=604800; SameSite=Lax`;
      }
    } else {
      // No hay sesión válida en Supabase, limpiar localStorage
      localStorage.removeItem('auth_user');
      authStore.set({
        user: null,
        isLoading: false,
        error: null,
        initialized: true,
      });
    }

    // Subscribe to auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      authStore.set({
        user: session?.user || null,
        isLoading: false,
        error: null,
        initialized: true,
      });

      // Save to localStorage
      if (session?.user) {
        localStorage.setItem('auth_user', JSON.stringify(session.user));
        
        // Save tokens as cookies for SSR (accessible by server)
        if (session.access_token) {
          document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=3600; SameSite=Lax`;
        }
        if (session.refresh_token) {
          document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=604800; SameSite=Lax`;
        }
      } else {
        localStorage.removeItem('auth_user');
        // Clear cookies
        document.cookie = 'sb-access-token=; path=/; max-age=0';
        document.cookie = 'sb-refresh-token=; path=/; max-age=0';
      }
    });
  } catch (error) {
    console.error('Error initializing auth:', error);
    authStore.set({
      user: null,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Error initializing auth',
      initialized: true,
    });
  }
}

// Auth actions
export async function login(email: string, password: string) {
  const current = authStore.get();
  authStore.set({ ...current, isLoading: true, error: null });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    authStore.set({
      user: data.user,
      isLoading: false,
      error: null,
      initialized: true,
    });

    return { success: true, user: data.user };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error logging in';
    const current = authStore.get();
    authStore.set({ ...current, isLoading: false, error: message });
    return { success: false, error: message };
  }
}

export async function register(email: string, password: string, fullName: string) {
  const current = authStore.get();
  authStore.set({ ...current, isLoading: true, error: null });

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;

    authStore.set({
      user: data.user,
      isLoading: false,
      error: null,
      initialized: true,
    });

    return { success: true, user: data.user };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error registering';
    const current = authStore.get();
    authStore.set({ ...current, isLoading: false, error: message });
    return { success: false, error: message };
  }
}

export async function logout() {
  console.log('Logout iniciado...');
  
  try {
    // 1. Limpiar estado local inmediatamente
    authStore.set({
      user: null,
      isLoading: false,
      error: null,
      initialized: false,
    });

    // 2. Limpiar localStorage
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_session');
    
    // Limpiar todo lo relacionado con supabase
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    console.log('localStorage limpiado');

    // 3. Limpiar cookies del cliente
    document.cookie = 'sb-access-token=; path=/; max-age=0';
    document.cookie = 'sb-refresh-token=; path=/; max-age=0';
    console.log('Cookies del cliente limpiadas');

    // 4. Cerrar sesión en Supabase (no esperar si falla)
    supabase.auth.signOut().catch(err => {
      console.warn('Supabase signOut warning:', err);
    });

    console.log('Redirigiendo a inicio...');
    
    // 5. Forzar recarga completa
    window.location.href = '/';
    
    return { success: true };
  } catch (error) {
    console.error('Error en logout:', error);
    // Aún así, forzar recarga
    window.location.href = '/';
    return { success: false, error: String(error) };
  }
}

export function getCurrentUser() {
  const state = authStore.get();
  return state.user;
}

export function isAuthenticated() {
  const state = authStore.get();
  return !!state.user;
}
