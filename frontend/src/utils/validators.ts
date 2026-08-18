/**
 * Pure validators (no side effects) — see docs/architecture.md §3.
 * Used by AntD `Form` rules so validation logic stays testable outside React.
 */

/**
 * Pragmatic email shape check: exactly one `@`, non-empty local part, a dot in
 * the domain, no whitespace. Deliberately NOT a full RFC 5322 regex — the
 * backend is the authority; this only catches obvious typos client-side.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** The user *intended* an email (so we should validate its shape). */
export function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}

/**
 * Login identifier accepts EITHER an email OR a username
 * (`POST /auth/login` takes one `username` field for both).
 * Rule: if it contains `@` it must be a well-formed email; otherwise any
 * non-empty trimmed value is accepted as a username — we must not invent
 * username restrictions the backend doesn't have.
 */
export function isValidLoginIdentifier(value: string | undefined | null): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return false;
  }
  return looksLikeEmail(trimmed) ? isEmail(trimmed) : true;
}

/**
 * Open-redirect guard for the post-login return path. Only same-origin
 * absolute paths are allowed: must start with a single `/`, must not start
 * with `//` (protocol-relative URL) or `/\`, and must not contain a scheme.
 */
export function isSafeRedirectPath(value: string | undefined | null): boolean {
  if (!value || !value.startsWith('/')) {
    return false;
  }
  if (value.startsWith('//') || value.startsWith('/\\')) {
    return false;
  }
  return !/^\/+\s*[a-z][a-z0-9+.-]*:/i.test(value);
}

export function sanitizeRedirectPath(
  value: string | undefined | null,
  fallback = '/dashboard',
): string {
  return isSafeRedirectPath(value) ? (value as string) : fallback;
}
