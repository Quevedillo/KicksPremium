import { atom } from 'nanostores';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase';

export interface AuthStore {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export const authStore = atom<AuthStore>({
  user: null,
  isLoading: true,
  error: null,
});

// Initialize auth state from session
export async function initializeAuth() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    authStore.set({
      user: session?.user || null,
      isLoading: false,
      error: null,
    });

    // Subscribe to auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      authStore.set({
        user: session?.user || null,
        isLoading: false,
        error: null,
      });

      // Save to localStorage
      if (session?.user) {
        localStorage.setItem('auth_user', JSON.stringify(session.user));
      } else {
        localStorage.removeItem('auth_user');
      }
    });
  } catch (error) {
    authStore.set({
      user: null,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Error initializing auth',
    });
  }
}

// Auth actions
export async function login(email: string, password: string) {
  authStore.set((state) => ({ ...state, isLoading: true, error: null }));

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
    authStore.set((state) => ({ ...state, isLoading: false, error: message }));
    return { success: false, error: message };
  }
}

export async function register(email: string, password: string, fullName: string) {
  authStore.set((state) => ({ ...state, isLoading: true, error: null }));

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
    authStore.set((state) => ({ ...state, isLoading: false, error: message }));
    return { success: false, error: message };
  }
}

export async function logout() {
  authStore.set((state) => ({ ...state, isLoading: true, error: null }));

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
    authStore.set((state) => ({ ...state, isLoading: false, error: message }));
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
