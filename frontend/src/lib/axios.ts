import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { ApiErrorBody, ApiErrorResponse } from '@/types/api.types';

// NOTE: services/auth.service.ts imports `apiClient` from this file, so this
// is a circular import. It's safe: both sides only touch the other's
// binding inside function bodies (called later, at request time), never at
// module top-level/init time.
import { refreshAccessToken } from '@/services/auth.service';


const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * Shared axios instance. Components/hooks must NEVER import this directly —
 * only `services/*.service.ts` files are allowed to, per the folder rule in
 * frontend/CLAUDE.md.
 */
export const apiClient = axios.create({
  baseURL,
  // Refresh token is an HttpOnly cookie — must be sent for /auth/refresh.
  withCredentials: true,
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// --- Request interceptor: attach access token from authStore -------------

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

const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh'];

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

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => originalRequest?.url?.includes(endpoint));

    if (status !== 401 || !originalRequest || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another request already triggered a refresh — queue behind it
      // instead of firing a second /auth/refresh call.
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
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

/**
 * Safely extract `{ code, message, details }` from any error thrown by
 * `apiClient`, per the real backend envelope:
 *   { success: false, error: { code, message, details? }, timestamp }
 *
 * Callers can still read the raw shape directly via
 * `error.response.data.error.code` — this helper just adds a safe fallback
 * for network-level failures where `error.response` is undefined (e.g. the
 * backend isn't reachable yet).
 */
export function getApiError(error: unknown): ApiErrorBody {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const body = error.response?.data?.error;
    if (body) {
      return body;
    }
    return {
      code: error.code || 'NETWORK_ERROR',
      message: error.message || 'Network error, please try again.',
    };
  }
  return { code: 'UNKNOWN_ERROR', message: 'Unexpected error occurred.' };
}
