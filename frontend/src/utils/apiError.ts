import axios from 'axios';
import dayjs from 'dayjs';
import type { ApiErrorBody, ApiErrorResponse } from '@/types/api.types';

/**
 * Error-envelope helpers. Pure functions — they only import the `axios`
 * package for its `isAxiosError` type guard, never our configured instance,
 * so this module stays side-effect free.
 *
 * Backend envelope (backend/docs/api-spec.md §1.2):
 *   { success: false, error: { code, message, details? }, timestamp }
 *
 * IMPORTANT: `error.message` is English developer text — never render it to
 * the user. Always map `error.code` to an i18n key via `apiErrorKey()`.
 */

export const API_ERROR_I18N_PREFIX = 'errors.api.';
export const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';

/** Only `[A-Z0-9_]` codes are trusted as i18n key fragments. */
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function getApiError(error: unknown): ApiErrorBody {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const body = error.response?.data?.error;
    if (body?.code) {
      return body;
    }
    return {
      code: error.code || 'NETWORK_ERROR',
      message: error.message || 'Network error, please try again.',
    };
  }
  return { code: UNKNOWN_ERROR_CODE, message: 'Unexpected error occurred.' };
}

export function getHttpStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * Build the i18n key for an API error code, e.g.
 * `INVALID_CREDENTIALS` -> `errors.api.INVALID_CREDENTIALS`.
 * Unrecognised / non-conforming codes fall back to the generic key so we can
 * never interpolate arbitrary server text into a translation lookup.
 */
export function apiErrorKey(code?: string | null): string {
  const safe = code && CODE_PATTERN.test(code) ? code : UNKNOWN_ERROR_CODE;
  return `${API_ERROR_I18N_PREFIX}${safe}`;
}

/**
 * Best-effort "how long is the account locked for" extraction, in minutes.
 *
 * The api-spec does not pin down where the remaining lock time is carried, so
 * this checks every plausible location and returns `null` when none is
 * present (callers then show the generic ACCOUNT_LOCKED message):
 *   - `Retry-After` response header (seconds, or an HTTP date)
 *   - `error.retryAfterSeconds` / `error.remainingSeconds` (number)
 *   - `error.lockedUntil` / `error.lockedUntilAt` (ISO timestamp)
 */
export function getLockRemainingMinutes(error: unknown): number | null {
  const seconds = getLockRemainingSeconds(error);
  if (seconds === null || seconds <= 0) {
    return null;
  }
  return Math.max(1, Math.ceil(seconds / 60));
}

function getLockRemainingSeconds(error: unknown): number | null {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return null;
  }

  const retryAfter = error.response?.headers?.['retry-after'];
  if (typeof retryAfter === 'string' && retryAfter.trim()) {
    const asNumber = Number(retryAfter);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }
    const asDate = dayjs(retryAfter);
    if (asDate.isValid()) {
      return asDate.diff(dayjs(), 'second');
    }
  }

  const body = error.response?.data?.error as (ApiErrorBody & Record<string, unknown>) | undefined;
  if (!body) {
    return null;
  }

  for (const field of ['retryAfterSeconds', 'remainingSeconds'] as const) {
    const value = body[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  for (const field of ['lockedUntil', 'lockedUntilAt'] as const) {
    const value = body[field];
    if (typeof value === 'string') {
      const until = dayjs(value);
      if (until.isValid()) {
        return until.diff(dayjs(), 'second');
      }
    }
  }

  return null;
}
