import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { ApiErrorResponse } from '@/types/api.types';

// NOTE: services/auth.service.ts imports `apiClient` from this file, so this
// is a circular import. It's safe: both sides only touch the other's
// binding inside function bodies (called later, at request time), never at
// module top-level/init time.
import { refreshAccessToken } from '@/services/auth.service';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Per-call opt-in for cookie credentials.
 *
 * Only `POST /auth/login` (receives the `Set-Cookie`) and `POST /auth/refresh`
 * (sends the cookie + gets it rotated) may use this — see
 * services/auth.service.ts. The refresh token is an HttpOnly cookie that the
 * backend scopes to `Path=/api/v1/auth/refresh`, and JS can never read it.
 * Everything else — `/auth/me`, `/auth/logout` (the backend identifies the
 * session from the `sid` claim in the access token), `/auth/change-password`,
 * `/auth/forgot-password`, `/auth/reset-password` and all business endpoints —
 * authenticates with the Bearer token alone.
 */
export const CREDENTIALED_REQUEST = { withCredentials: true } as const;

/**
 * Shared axios instance. Components/hooks must NEVER import this directly —
 * only `services/*.service.ts` files are allowed to, per the folder rule in
 * frontend/CLAUDE.md.
 *
 * DO NOT add `withCredentials: true` to this config. A global flag would ask
 * the browser for credentials on every request, including the ones that have no
 * business with the refresh cookie. Use `CREDENTIALED_REQUEST` per call instead.
 */
export const apiClient = axios.create({
  baseURL,
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

// --- Response interceptor: 401 -> refresh once, queue concurrent 401s ----

/**
 * Endpoints that must never trigger the refresh-and-retry dance:
 * - `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` are public,
 *   a 401/400 there is a real answer for the caller.
 * - `/auth/refresh` returning 401 IS the refresh failure itself (retrying it
 *   would recurse).
 * - `/auth/logout` — if the token is already dead there is nothing to save.
 * `/auth/me` is intentionally absent: it must be retried after a refresh.
 */
const NO_REFRESH_ENDPOINTS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

/**
 * 401 codes that are DOMAIN errors, not "your access token is stale".
 * `POST /auth/change-password` answers `401 WRONG_CURRENT_PASSWORD`; refreshing
 * and replaying that request would silently re-submit the wrong password (and
 * could count toward the account lockout), so never retry these.
 */
const NON_TOKEN_401_CODES = ['WRONG_CURRENT_PASSWORD', 'INVALID_CREDENTIALS'];

/** Public routes where a hard redirect to /login would be pointless/annoying. */
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

/**
 * Marks a redirect caused by a refresh that FAILED, as opposed to a visit to
 * /login for any other reason.
 *
 * It exists because the redirect below is a full page load, which wipes the
 * in-memory `sessionChecked` flag — so the login screen's guard would try to
 * restore the session all over again, and if the cookie still looks usable it
 * would bounce the user straight back to the page that just failed, and round
 * again. The flag stops that loop: a session we just failed to restore is not
 * worth retrying on arrival.
 */
export const SESSION_EXPIRED_PARAM = 'sessionExpired';

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) {
      resolve(token);
    } else {
      reject(error);
    }
  });
  pendingQueue = [];
}

/**
 * Hard redirect after an unrecoverable refresh failure. Uses `location.replace`
 * so the authenticated page the user was on cannot be reached with the browser
 * Back button, and preserves the attempted URL in `?redirect=` so the login
 * page can send the user back after re-authenticating.
 */
function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }
  const { pathname, search } = window.location;
  if (PUBLIC_PATHS.includes(pathname)) {
    return;
  }
  const target = `${pathname}${search}`;
  window.location.replace(
    `/login?redirect=${encodeURIComponent(target)}&${SESSION_EXPIRED_PARAM}=1`,
  );
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const errorCode = error.response?.data?.error?.code;
    const skipRefresh =
      NO_REFRESH_ENDPOINTS.some((endpoint) => originalRequest?.url?.includes(endpoint)) ||
      (errorCode ? NON_TOKEN_401_CODES.includes(errorCode) : false);

    if (status !== 401 || !originalRequest || originalRequest._retry || skipRefresh) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another request already triggered a refresh — queue behind it
      // instead of firing a second /auth/refresh call.
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            originalRequest._retry = true;
            if (!originalRequest.headers) {
              originalRequest.headers = new AxiosHeaders();
            }
            originalRequest.headers.set('Authorization', `Bearer ${token}`);
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Must go through the service function: it is the one that passes
      // `CREDENTIALED_REQUEST`, so the refresh cookie is actually sent. A bare
      // `apiClient.post('/auth/refresh')` here would silently omit it.
      const newToken = await refreshAccessToken();
      flushQueue(null, newToken);

      if (!originalRequest.headers) {
        originalRequest.headers = new AxiosHeaders();
      }
      originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
      return apiClient(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      useAuthStore.getState().clearAuth();
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
