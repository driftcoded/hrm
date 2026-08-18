import { create } from 'zustand';
import type { AuthUser } from '@/types/auth.types';

/**
 * Auth state — access token kept in memory only (no persist middleware).
 * Refresh token lives in an HttpOnly cookie set by the backend and is never
 * touched from JS. See docs/architecture.md §6.1.
 */
interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  setAuth: (accessToken, user) => set({ accessToken, user, isAuthenticated: true }),
  clearAuth: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}));
