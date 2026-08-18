import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  /** Số lần login sai liên tiếp trước khi khoá tài khoản. */
  maxFailedLoginAttempts: number;
  /** Thời gian khoá (phút) sau khi vượt maxFailedLoginAttempts. */
  lockoutMinutes: number;
  /** Số session (refresh token còn hiệu lực) tối đa cho mỗi user. */
  maxConcurrentSessions: number;
  /** Thời gian sống của token reset password (phút). */
  resetTokenTtlMinutes: number;
  /** Tên cookie chứa refresh token. */
  refreshCookieName: string;
  /** URL frontend – dùng cho CORS + link trong email reset password. */
  frontendUrl: string;
}

export const authConfig = registerAs('auth', (): AuthConfig => ({
  maxFailedLoginAttempts: parseInt(
    process.env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS ?? '5',
    10,
  ),
  lockoutMinutes: parseInt(process.env.AUTH_LOCKOUT_MINUTES ?? '15', 10),
  maxConcurrentSessions: parseInt(
    process.env.AUTH_MAX_CONCURRENT_SESSIONS ?? '5',
    10,
  ),
  resetTokenTtlMinutes: parseInt(
    process.env.AUTH_RESET_TOKEN_TTL_MINUTES ?? '30',
    10,
  ),
  refreshCookieName: process.env.AUTH_REFRESH_COOKIE_NAME ?? 'refresh_token',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
}));
