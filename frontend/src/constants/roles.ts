import type { UserRole } from '@/types/auth.types';

/**
 * Role capability lists — one place, so no component ever compares role strings
 * inline.
 *
 * `MASTER_DATA_WRITE_ROLES` mirrors the backend's
 * `src/common/constants/roles.constant.ts`. Keep the two in sync: a role listed
 * here but not there gets buttons that 403, and a role listed there but not here
 * loses controls it is allowed to use.
 */
export const MASTER_DATA_WRITE_ROLES: readonly UserRole[] = ['admin', 'hr_manager', 'hr_staff'];
