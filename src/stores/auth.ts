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
    }

    // Si hay sesión, usarla
    if (session?.user) {
      authStore.set({
        user: session.user,
        isLoading: false,
        error: null,
        initialized: true,
      });
      localStorage.setItem('auth_user', JSON.stringify(session.user));
    } else {
      // Si no hay sesión en Supabase, verificar localStorage como fallback
      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          // Verificar si el token aún es válido
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            authStore.set({
              user: currentUser,
              isLoading: false,
              error: null,
              initialized: true,
            });
          } else {
            // Token inválido, limpiar
            localStorage.removeItem('auth_user');
            authStore.set({
              user: null,
              isLoading: false,
              error: null,
              initialized: true,
            });
          }
        } catch {
          localStorage.removeItem('auth_user');
          authStore.set({
            user: null,
            isLoading: false,
            error: null,
            initialized: true,
          });
        }
      } else {
        authStore.set({
          user: null,
          isLoading: false,
          error: null,
          initialized: true,
        });
      }
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
      } else {
        localStorage.removeItem('auth_user');
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
  const current = authStore.get();
  authStore.set({ ...current, isLoading: true, error: null });

  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    authStore.set({
      user: null,
      isLoading: false,
      error: null,
    });

    localStorage.removeItem('auth_user');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error logging out';
    const current = authStore.get();
    authStore.set({ ...current, isLoading: false, error: message });
    return { success: false, error: message };
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
