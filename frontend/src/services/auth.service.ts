import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import type { ApiSuccessResponse } from '@/types/api.types';
import type { AuthTokenData, LoginPayload } from '@/types/auth.types';

/**
 * Auth API calls. NOTE: these backend endpoints don't exist yet as of
 * Giai đoạn 0 (scaffold phase) — they'll be exercised for real once the
 * backend implements auth in Giai đoạn 1. Written now so the axios
 * refresh-interceptor in lib/axios.ts has something real to call.
 */

export async function login(payload: LoginPayload): Promise<AuthTokenData> {
  const { data } = await apiClient.post<ApiSuccessResponse<AuthTokenData>>('/auth/login', payload);
  useAuthStore.getState().setAuth(data.data.accessToken, data.data.user);
  return data.data;
}

export async function refreshAccessToken(): Promise<string> {
  // Refresh token cookie is attached automatically (withCredentials: true).
  const { data } = await apiClient.post<ApiSuccessResponse<AuthTokenData>>('/auth/refresh');
  useAuthStore.getState().setAuth(data.data.accessToken, data.data.user);
  return data.data.accessToken;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    useAuthStore.getState().clearAuth();
  }
}
