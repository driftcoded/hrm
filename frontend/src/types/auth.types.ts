/**
 * Auth types — mirror the real backend contract in backend/docs/api-spec.md §2
 * (`POST /auth/login`, `/auth/refresh`, `/auth/me`, `/auth/change-password`,
 * `/auth/forgot-password`, `/auth/reset-password`).
 *
 * Numeric ids: api-spec.md shows `user.id` / `employee.id` as numbers.
 */

/** Role technical names — database-schema.md §roles. */
export type UserRole = 'admin' | 'hr_manager' | 'hr_staff' | 'manager' | 'employee';

/** Minimum password length. Backend enforces it too (api-spec.md §2). */
export const PASSWORD_MIN_LENGTH = 8;

export interface AuthEmployee {
  id: number;
  fullName: string;
  avatarUrl: string | null;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  /** Kept widened to `string` so an unknown role from the API can't crash the UI. */
  role: UserRole | string;
  /** `null` for accounts not yet linked to an employee record (e.g. seeded admin). */
  employee: AuthEmployee | null;
}

export interface LoginPayload {
  /** Accepts EITHER a username OR an email — see api-spec.md `POST /auth/login`. */
  username: string;
  password: string;
  /** Only controls the refresh-cookie lifetime on the backend. */
  rememberMe?: boolean;
}

export interface LoginData {
  accessToken: string;
  /** Access token lifetime in seconds (e.g. 900). */
  expiresIn: number;
  user: AuthUser;
}

/**
 * `POST /auth/refresh` returns a fresh access token and rotates the HttpOnly
 * cookie. `user` is NOT guaranteed to be present in the response, so the
 * refresh path must never overwrite the cached user with `undefined`.
 */
export interface RefreshData {
  accessToken: string;
  expiresIn: number;
  user?: AuthUser;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/** Login form shape (the visible field is labelled "Email hoặc tên đăng nhập"). */
export interface LoginFormValues {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordFormValues {
  newPassword: string;
  confirmPassword: string;
}

export interface ForgotPasswordFormValues {
  email: string;
}
