import type { AuthUser } from '@/types/auth.types';

/** Pure display helpers for the logged-in user. */

/**
 * Name shown in the header / profile: the linked employee's full name, falling
 * back to the login username when the account has no employee record.
 */
export function getUserDisplayName(user: AuthUser | null | undefined): string {
  if (!user) {
    return '';
  }
  const fullName = user.employee?.fullName?.trim();
  return fullName || user.username;
}

/** i18n key for a role technical name, e.g. `admin` -> `roles.admin`. */
export function roleI18nKey(role: string | undefined | null): string {
  const safe = role && /^[a-z][a-z0-9_]*$/.test(role) ? role : 'unknown';
  return `roles.${safe}`;
}
