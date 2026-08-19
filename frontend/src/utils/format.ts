import dayjs from 'dayjs';

/**
 * VN display formatters — see frontend/CLAUDE.md "Format hiển thị (CHUẨN VN)"
 * and docs/ui-conventions.md §6. Every place in the app that renders
 * currency/phone/CCCD/dates must go through here instead of formatting
 * inline.
 */

/**
 * 1234567 -> "1.234.567" — a whole number with VN thousands separators.
 *
 * The base for `formatCurrency`, and what counts (headcount, records) use on
 * their own. Rounds, because none of those quantities is fractional.
 */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** 1000000 -> "1.000.000 ₫" (dot thousands separator, no decimals). */
export function formatCurrency(value: number): string {
  return `${formatNumber(value)} ₫`;
}

/** "0901234567" -> "0901 234 567" (4-3-3 grouping). */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10) {
    return phone;
  }
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
}

/** "001201012345" -> "001***876543" (show first 3 + last 6, mask the rest). */
export function maskCccd(cccd: string): string {
  const digits = cccd.replace(/\D/g, '');
  if (digits.length <= 9) {
    return cccd;
  }
  return `${digits.slice(0, 3)}***${digits.slice(-6)}`;
}

export function formatDate(value: string | number | Date, format = 'DD/MM/YYYY'): string {
  return dayjs(value).format(format);
}

export function formatDateTime(value: string | number | Date): string {
  return formatDate(value, 'DD/MM/YYYY HH:mm');
}

/** 85.5 -> "85.5%" (max 1 decimal digit, no space before %). */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
}
