import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { api } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  clearError: () => void;
  initAuth: () => Promise<void>;
  setAuthenticatedUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      initAuth: async () => {
        const hasToken = api.loadToken();
        if (hasToken) {
          try {
            await get().fetchUser();
          } catch {
            api.clearToken();
            set({ isAuthenticated: false, user: null });
          }
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.login(email, password);
          const user = await api.getMe();
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false 
          });
        } catch (err: any) {
          set({ 
            error: err.message || 'Login failed', 
            isLoading: false,
            isAuthenticated: false 
          });
          throw err;
        }
      },

      logout: () => {
        api.clearToken();
        set({ 
          user: null, 
          isAuthenticated: false, 
          error: null 
        });
      },

      fetchUser: async () => {
        try {
          const user = await api.getMe();
          set({ user, isAuthenticated: true });
        } catch (err: any) {
          set({ error: err.message });
          throw err;
        }
      },

      clearError: () => set({ error: null }),

      setAuthenticatedUser: (user: User) => {
        set({ user, isAuthenticated: true, isLoading: false, error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
