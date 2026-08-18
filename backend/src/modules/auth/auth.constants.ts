/** Độ dài tối thiểu của mật khẩu mới (khớp validate ở frontend). */
export const MIN_PASSWORD_LENGTH = 8;

/** Số byte random của refresh token và reset-password token. */
export const TOKEN_RANDOM_BYTES = 32;

const CACHE_PREFIX = 'auth';

/** Key đếm số lần login sai liên tiếp theo identifier (username/email đã lower-case). */
export const loginFailureCacheKey = (identifier: string): string =>
  `${CACHE_PREFIX}:login:fail:${identifier.trim().toLowerCase()}`;

/** Key giữ trạng thái "đang bị khoá" theo identifier. */
export const loginLockCacheKey = (identifier: string): string =>
  `${CACHE_PREFIX}:login:lock:${identifier.trim().toLowerCase()}`;

/**
 * Key lưu token reset password. Cache chỉ lưu SHA-256 hash của token,
 * giá trị thật chỉ có trong email.
 */
export const resetTokenCacheKey = (tokenHash: string): string =>
  `${CACHE_PREFIX}:reset:${tokenHash}`;

/**
 * Payload lưu kèm token reset password.
 * `expiresAt` được lưu tường minh (dù cache đã có TTL) để phân biệt
 * RESET_TOKEN_EXPIRED (token đúng nhưng quá hạn) với RESET_TOKEN_INVALID
 * (token không tồn tại / đã dùng). Cache TTL = TTL logic + RESET_TOKEN_GRACE_SECONDS.
 */
export interface ResetTokenCachePayload {
  userId: number;
  /** ISO-8601 */
  expiresAt: string;
}

/** Thời gian giữ thêm entry sau khi token hết hạn logic, để trả đúng mã lỗi EXPIRED. */
export const RESET_TOKEN_GRACE_SECONDS = 15 * 60;
