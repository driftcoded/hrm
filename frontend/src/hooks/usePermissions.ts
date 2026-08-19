import { useAuthStore } from '@/store/authStore';
import {
  ATTENDANCE_EXPORT_ROLES,
  ATTENDANCE_READ_ALL_ROLES,
  ATTENDANCE_WRITE_ROLES,
  CONTRACT_WRITE_ROLES,
  EMPLOYEE_EXPORT_ROLES,
  EMPLOYEE_DELETE_ROLES,
  EMPLOYEE_WRITE_ROLES,
  MASTER_DATA_WRITE_ROLES,
  USER_WRITE_ROLES,
} from '@/constants/roles';
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

/** May the user create/edit an employee record? (`admin`, `hr_manager`, `hr_staff`) */
export function useCanWriteEmployees(): boolean {
  return useHasRole(EMPLOYEE_WRITE_ROLES);
}

/**
 * May the user soft-delete or restore an employee? (`admin`, `hr_manager`)
 *
 * Deliberately narrower than `useCanWriteEmployees`: `hr_staff` can create and
 * correct records but not remove people, which is what the backend enforces.
 */
export function useCanDeleteEmployees(): boolean {
  return useHasRole(EMPLOYEE_DELETE_ROLES);
}

/** May the user sign, edit or end a labour contract? (`admin`, `hr_manager`) */
export function useCanWriteContracts(): boolean {
  return useHasRole(CONTRACT_WRITE_ROLES);
}

/**
 * May the user create a login account? (`admin` only)
 *
 * Drives whether the create wizard shows its account step at all — offering it
 * to `hr_staff` would mean a wizard whose last step is guaranteed to 403.
 */
export function useCanCreateUsers(): boolean {
  return useHasRole(USER_WRITE_ROLES);
}

/**
 * May the user export the employee list to Excel? (`admin`, `hr_manager`,
 * `hr_staff`)
 *
 * `manager` sees the list on screen but cannot export it — see
 * `EMPLOYEE_EXPORT_ROLES` for why the two differ.
 */
export function useCanExportEmployees(): boolean {
  return useHasRole(EMPLOYEE_EXPORT_ROLES);
}

/**
 * May the user see the company-wide attendance table? (`admin`, `hr_manager`,
 * `hr_staff`, `manager`)
 *
 * Everyone else gets their own month at `/attendance` and never sees the
 * company table — the backend refuses it, so showing the tab would be a
 * guaranteed 403.
 */
export function useCanReadAllAttendance(): boolean {
  return useHasRole(ATTENDANCE_READ_ALL_ROLES);
}

/**
 * May the user adjust an attendance record or import a timesheet?
 * (`admin`, `hr_manager`, `hr_staff`)
 *
 * Narrower than reading on purpose — see `ATTENDANCE_WRITE_ROLES`.
 */
export function useCanWriteAttendance(): boolean {
  return useHasRole(ATTENDANCE_WRITE_ROLES);
}

/** May the user export the monthly timesheet to Excel? */
export function useCanExportAttendance(): boolean {
  return useHasRole(ATTENDANCE_EXPORT_ROLES);
}
