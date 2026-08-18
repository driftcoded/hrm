import { CREDENTIALED_REQUEST, apiClient } from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  AuthUser,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginData,
  LoginPayload,
  RefreshData,
  ResetPasswordPayload,
} from '@/types/auth.types';

/**
 * Auth API calls — the ONLY place allowed to talk to `/auth/*`
 * (frontend/CLAUDE.md folder rule). Contract: backend/docs/api-spec.md §2.
 *
 * These functions own the `authStore` writes on purpose: `refreshAccessToken`
 * is invoked from the axios response interceptor (plain module code, no React
 * context available), so the token plumbing cannot live in a hook. Hooks in
 * `hooks/useAuth.ts` wrap these with TanStack Query for the UI layer.
 */

/**
 * `GET /auth/me` "returns the same user shape as login" — the spec doesn't say
 * whether the user sits at `data` or `data.user`, so accept both.
 */
type MeResponseData = AuthUser | { user: AuthUser };

function unwrapUser(data: MeResponseData): AuthUser {
  if (data && typeof data === 'object' && 'user' in data && data.user) {
    return data.user;
  }
  return data as AuthUser;
}

export async function login(payload: LoginPayload): Promise<LoginData> {
  // CREDENTIALED_REQUEST: this response carries the `Set-Cookie` for the
  // HttpOnly refresh token. One of only two calls allowed to ask for
  // credentials — do not move this flag onto the shared axios instance.
  const { data } = await apiClient.post<ApiSuccessResponse<LoginData>>(
    '/auth/login',
    payload,
    CREDENTIALED_REQUEST,
  );
  useAuthStore.getState().setAuth(data.data.accessToken, data.data.user);
  return data.data;
}

/**
 * `POST /auth/refresh` takes NO body — the HttpOnly refresh cookie is attached
 * by the browser. This is the only call whose REQUEST needs the cookie, so it
 * passes `CREDENTIALED_REQUEST` explicitly instead of relying on an instance
 * default; the backend scopes the cookie to `Path=/api/v1/auth/refresh` so it
 * is never sent anywhere else. JS cannot read the cookie (HttpOnly), which is
 * why the token has to be re-minted through this endpoint after F5.
 *
 * The axios 401-retry interceptor calls this function (not a bare
 * `apiClient.post`), so the interceptor's internal refresh is credentialed too.
 *
 * Only the access token is updated: the response is not guaranteed to carry
 * the user, and overwriting a cached user with `undefined` would log the user
 * out on every silent refresh.
 */
export async function refreshAccessToken(): Promise<string> {
  const { data } = await apiClient.post<ApiSuccessResponse<RefreshData>>(
    '/auth/refresh',
    undefined,
    CREDENTIALED_REQUEST,
  );
  const { accessToken, user } = data.data;
  const store = useAuthStore.getState();
  store.setAccessToken(accessToken);
  if (user) {
    store.setUser(user);
  }
  return accessToken;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<ApiSuccessResponse<MeResponseData>>('/auth/me');
  const user = unwrapUser(data.data);
  useAuthStore.getState().setUser(user);
  return user;
}

/**
 * Silent session restore after a full page reload (F5): the access token lives
 * in memory only, so we mint a new one from the refresh cookie and then reload
 * the user profile. On failure the store is cleared (and `sessionChecked` set)
 * so route guards can redirect to /login instead of hanging.
 */
export async function restoreSession(): Promise<AuthUser> {
  try {
    await refreshAccessToken();
    return await getCurrentUser();
  } catch (error) {
    useAuthStore.getState().clearAuth();
    throw error;
  }
}

/**
 * No credentials needed: the backend identifies the session from the `sid`
 * claim inside the access token, so the Bearer header is enough.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    // Always drop local auth state, even if the server call fails.
    useAuthStore.getState().clearAuth();
  }
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await apiClient.post('/auth/change-password', payload);
}

/** Always resolves with success on the backend side (no user enumeration). */
export async function forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
  await apiClient.post('/auth/forgot-password', payload);
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await apiClient.post('/auth/reset-password', payload);
}
