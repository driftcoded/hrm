import { useAuthStore } from '@/store/authStore';
import { MASTER_DATA_WRITE_ROLES } from '@/constants/roles';
import type { UserRole } from '@/types/auth.types';

/**
 * Role checks for the UI.
 *
 * These hide controls the current user cannot use — they are NOT a security
 * boundary. The backend guards every write endpoint (`403 FORBIDDEN`), and that
 * is what actually protects the data; this only keeps the screen honest so
 * nobody clicks a button that is guaranteed to fail.
 */

/** True when the logged-in user's role is one of `roles`. */
export function useHasRole(roles: readonly UserRole[]): boolean {
  const role = useAuthStore((state) => state.user?.role);
  return role ? (roles as readonly string[]).includes(role) : false;
}

/**
 * May the user create/edit/delete master data (departments, positions, leave
 * types, holidays)?
 *
 * `admin`, `hr_manager` and `hr_staff` — the same three roles the backend
 * accepts. `manager` and `employee` get read-only screens: they can open the
 * pages by URL and see the tables, but no Add/Edit/Delete controls.
 */
export function useCanWriteMasterData(): boolean {
  return useHasRole(MASTER_DATA_WRITE_ROLES);
}
