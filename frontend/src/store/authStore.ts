import { create } from 'zustand';
import type { AuthUser } from '@/types/auth.types';

/**
 * Auth state — access token kept in memory only (no persist middleware).
 * Refresh token lives in an HttpOnly cookie set by the backend and is never
 * touched from JS. See docs/architecture.md §6.1.
 *
 * Because the token is memory-only it is lost on F5; `sessionChecked` tracks
 * whether the app has already attempted the silent restore
 * (`POST /auth/refresh` -> `GET /auth/me`) during this page lifetime, so we
 * neither skip it after a reload nor retry it after a logout.
 */
interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  sessionChecked: boolean;
  setAuth: (accessToken: string, user: AuthUser) => void;
  /**
   * Token-only update, used by the refresh flow. Must NOT touch `user` —
   * `POST /auth/refresh` doesn't necessarily return the user object.
   */
  setAccessToken: (accessToken: string) => void;
  /** User-only update, used by `GET /auth/me`. */
  setUser: (user: AuthUser) => void;
  /** Mark the silent-restore attempt as finished (success or failure). */
  markSessionChecked: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  sessionChecked: false,
  setAuth: (accessToken, user) =>
    set({ accessToken, user, isAuthenticated: true, sessionChecked: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) =>
    set((state) => ({
      user,
      // Authenticated only when we hold BOTH a token and a user.
      isAuthenticated: Boolean(state.accessToken),
      sessionChecked: true,
    })),
  markSessionChecked: () => set({ sessionChecked: true }),
  clearAuth: () =>
    set({ accessToken: null, user: null, isAuthenticated: false, sessionChecked: true }),
}));
