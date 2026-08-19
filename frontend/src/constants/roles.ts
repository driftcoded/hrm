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

/**
 * Vai trò được TẠO/SỬA hồ sơ nhân viên — mirrors the backend's
 * `EMPLOYEE_WRITE_ROLES`.
 */
export const EMPLOYEE_WRITE_ROLES: readonly UserRole[] = ['admin', 'hr_manager', 'hr_staff'];

/**
 * Vai trò được XOÁ MỀM / KHÔI PHỤC hồ sơ — narrower than write on purpose,
 * mirroring the backend: `hr_staff` enters data but may not delete it.
 */
export const EMPLOYEE_DELETE_ROLES: readonly UserRole[] = ['admin', 'hr_manager'];

/** Hợp đồng lao động: only `admin` / `hr_manager` may sign or end one. */
export const CONTRACT_WRITE_ROLES: readonly UserRole[] = ['admin', 'hr_manager'];

/** Tạo tài khoản đăng nhập (`POST /users`) — admin only. */
export const USER_WRITE_ROLES: readonly UserRole[] = ['admin'];
