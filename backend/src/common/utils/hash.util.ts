import { createHash, randomBytes } from 'crypto';

/**
 * SHA-256 hex. Dùng cho refresh token (`refresh_tokens.token_hash`) và token
 * reset password: DB/cache chỉ lưu hash, giá trị thật chỉ tồn tại ở cookie/email.
 * KHÔNG dùng cho password (password bắt buộc bcrypt salt rounds 10).
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Sinh token ngẫu nhiên dạng hex (mặc định 32 bytes = 256-bit entropy). */
export function generateRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
