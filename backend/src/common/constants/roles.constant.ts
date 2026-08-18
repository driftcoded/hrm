/** `roles.name` values for the 5 seeded roles (docs/database-schema.md §1.1). */
export const ROLE_ADMIN = 'admin';
export const ROLE_HR_MANAGER = 'hr_manager';
export const ROLE_HR_STAFF = 'hr_staff';
export const ROLE_MANAGER = 'manager';
export const ROLE_EMPLOYEE = 'employee';

/**
 * Roles allowed to CREATE/UPDATE/DELETE master data (departments, positions,
 * leave types, holidays) — as required by PLAN Phase 2.1.
 *
 * GET on master data does NOT declare `@Roles()`: any authenticated role can
 * read it (JwtAuthGuard still blocks requests without a token).
 *
 * ⚠️ api-spec.md §4/§5 lists `Roles: admin, hr_manager` for POST/PATCH/DELETE
 * (missing `hr_staff`). PLAN 2.1 is the source of truth here; see the Phase
 * 2.1 report.
 */
export const MASTER_DATA_WRITE_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
];

/**
 * Roles allowed to CREATE/UPDATE employee records (api-spec.md §3 –
 * POST/PATCH `/employees`, §10 – family members).
 */
export const EMPLOYEE_WRITE_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
];

/**
 * Roles allowed to SOFT-DELETE / RESTORE employee records.
 * Narrower than `EMPLOYEE_WRITE_ROLES` — api-spec.md §3 states that DELETE
 * `/employees/:id` is limited to `admin`, `hr_manager` (hr_staff can enter
 * data but cannot delete).
 */
export const EMPLOYEE_DELETE_ROLES: string[] = [ROLE_ADMIN, ROLE_HR_MANAGER];

/** Roles allowed to read any employee list/record (api-spec.md §3). */
export const EMPLOYEE_READ_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
];

/**
 * Labor contracts: GET is available to the HR group, writes are limited to
 * `admin`/`hr_manager` (api-spec.md §6 – POST/PATCH `/contracts`).
 */
export const CONTRACT_READ_ROLES: string[] = EMPLOYEE_READ_ROLES;
export const CONTRACT_WRITE_ROLES: string[] = [ROLE_ADMIN, ROLE_HR_MANAGER];
