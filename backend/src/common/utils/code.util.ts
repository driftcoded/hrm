/**
 * Normalizes master-data codes (`departments.code`, `positions.code`,
 * `leave_types.code`): trims whitespace and upper-cases.
 *
 * MySQL's UNIQUE constraint under the `utf8mb4_unicode_ci` collation is
 * case-insensitive, so without normalization `hr` would be rejected as a
 * duplicate of `HR` while the user sees a code that looks different from
 * what they typed — normalize up front to keep things consistent.
 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
