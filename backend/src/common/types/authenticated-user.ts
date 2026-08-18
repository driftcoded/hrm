/**
 * User đã xác thực, được JwtAuthGuard gán vào `req.user` từ payload access token.
 * Payload JWT: `{ sub, username, role, employeeId, sid }` (xem AuthService).
 */
export interface AuthenticatedUser {
  /** users.id (payload.sub) */
  userId: number;
  username: string;
  /** roles.name – ví dụ `admin`, `hr_manager`, `employee` */
  role: string;
  /** employees.id, `null` nếu tài khoản chưa liên kết hồ sơ nhân viên */
  employeeId: number | null;
  /**
   * refresh_tokens.id của session đã phát hành access token này (payload.sid).
   * Dùng cho logout: xác định session cần revoke mà KHÔNG cần đọc cookie
   * (cookie refresh token chỉ được gửi tới endpoint /auth/refresh).
   * `null` nếu token cũ được phát hành trước khi có claim này.
   */
  sessionId: number | null;
}

/** Payload thật nằm trong access token JWT. */
export interface AccessTokenPayload {
  sub: number;
  username: string;
  role: string;
  employeeId: number | null;
  /** session id = refresh_tokens.id (đổi sau mỗi lần rotation). */
  sid: number;
  iat?: number;
  exp?: number;
}
