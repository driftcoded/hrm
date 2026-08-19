import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  changePassword,
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  resetPassword,
  restoreSession,
} from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';

/**
 * Auth hooks — the only layer components are allowed to call
 * (Component -> Hook -> Service -> axios, docs/architecture.md §7).
 */

export const AUTH_QUERY_KEYS = {
  root: ['auth'] as const,
  session: ['auth', 'session'] as const,
  me: ['auth', 'me'] as const,
};

/**
 * Silent session restore. The access token is memory-only, so after F5 we mint
 * a new one from the HttpOnly refresh cookie and reload the profile
 * (`POST /auth/refresh` -> `GET /auth/me`).
 *
 * Runs at most once per page lifetime: `sessionChecked` is set by the store as
 * soon as the attempt settles (success, failure or logout), which flips
 * `enabled` off. TanStack Query additionally dedupes concurrent callers of the
 * same key, so parallel route guards can never fire two refreshes.
 *
 * @param allow pass `false` to suppress the attempt entirely. The login screen
 *   uses it when it was reached *because* a refresh just failed: that arrives as
 *   a full page load, which resets `sessionChecked`, so without this the guard
 *   would retry the restore and — if the cookie still looked usable — bounce the
 *   user back to the page that had just failed, over and over.
 */
export function useSessionRestore(allow = true) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionChecked = useAuthStore((state) => state.sessionChecked);
  const enabled = allow && !isAuthenticated && !sessionChecked;

  const { isLoading, isError } = useQuery({
    queryKey: AUTH_QUERY_KEYS.session,
    queryFn: restoreSession,
    enabled,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    /** True only while the restore attempt is actually in flight. */
    isRestoring: enabled && isLoading,
    isAuthenticated,
    restoreFailed: isError,
  };
}

/**
 * Current user profile from `GET /auth/me`. Falls back to the copy already in
 * `authStore` (written at login) so the UI has something to render on the
 * first paint.
 */
export function useCurrentUser() {
  const cachedUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useQuery({
    queryKey: AUTH_QUERY_KEYS.me,
    queryFn: getCurrentUser,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  return {
    user: query.data ?? cachedUser,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: () => {
      // Fresh session — drop every cache entry that might belong to a
      // previously logged-in user.
      queryClient.clear();
    },
  });
}

/**
 * Logout: revoke server-side, clear local state (done inside the service),
 * wipe the query cache and `replace` to /login so the browser Back button
 * cannot land on an authenticated page again.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: forgotPassword });
}

export function useResetPassword() {
  return useMutation({ mutationFn: resetPassword });
}
