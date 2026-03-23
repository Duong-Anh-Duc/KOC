import { create } from 'zustand';
import { clearPermissionCache } from '../hooks/usePermissions';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  token: string | null; // access token — memory only, NOT persisted
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  setToken: (token: string) => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: (user, token) => {
    // Only persist user info (display purposes), NOT the token
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  setToken: (token) => {
    set({ token });
  },

  updateUser: (partial) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, ...partial };
      localStorage.setItem('user', JSON.stringify(updated));
      return { user: updated };
    });
  },

  logout: () => {
    localStorage.removeItem('user');
    clearPermissionCache();
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
