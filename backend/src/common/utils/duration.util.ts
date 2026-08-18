const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/**
 * Chuyển chuỗi thời lượng kiểu `15m`, `7d`, `900s`, `12h` (định dạng của
 * JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN) sang số giây.
 * Chuỗi chỉ có số (`"900"`) được hiểu là giây.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/i.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration format: "${value}"`);
  }

  const amount = parseInt(match[1], 10);
  const unit = (match[2] ?? 's').toLowerCase();

  return amount * UNIT_SECONDS[unit];
}
