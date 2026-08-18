/**
 * Master-data types — departments, positions, contract types, leave types and
 * holidays (Giai đoạn 2.2).
 *
 * Every shape here was verified against the RUNNING backend, not only the DTO
 * source, because a few response fields differ from what the request accepts:
 *
 *   - a department response carries `manager: { id, fullName } | null` and
 *     `employeeCount`, while create/update take a flat `managerId`;
 *   - a position response carries `department: { id, name }`, while
 *     create/update take a flat `departmentId`;
 *   - a holiday response carries a derived `year` — never send it, the backend
 *     computes it from `holidayDate`;
 *   - `GET /leave-types` returns a PLAIN ARRAY (no pagination envelope).
 *
 * The `MAX_*` / `*_PATTERN` constants mirror the backend validators so the form
 * can reject obvious mistakes before a round trip. The backend stays the
 * authority — these only save the user a failed request.
 */

/** Codes are `[A-Za-z0-9_]{2,20}`; the server upper-cases them on write. */
export const MASTER_CODE_PATTERN = /^[A-Za-z0-9_]{2,20}$/;
export const MASTER_CODE_MIN_LENGTH = 2;
export const MASTER_CODE_MAX_LENGTH = 20;

/** `limit` above this is rejected with 400 by the backend. */
export const MAX_PAGE_LIMIT = 100;

// --------------------------------------------------------------------------
// Departments
// --------------------------------------------------------------------------

export const DEPARTMENT_NAME_MAX_LENGTH = 150;
export const MAX_SORT_ORDER = 32767;

export interface EmployeeRef {
  id: number;
  fullName: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description: string | null;
  /** `null` = root department. */
  parentId: number | null;
  manager: EmployeeRef | null;
  /** Employees currently assigned — drives the "cannot delete" explanation. */
  employeeCount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `GET /departments/tree` — same row plus nested `children`. */
export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
}

export interface DepartmentPayload {
  code: string;
  name: string;
  description?: string | null;
  /** `null` detaches the department to root level (verified with PATCH). */
  parentId?: number | null;
  /** An `employees.id`. `null` clears the manager. */
  managerId?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

export const DEPARTMENT_SORT_KEYS = ['code', 'name', 'sortOrder', 'createdAt'] as const;
export type DepartmentSortKey = (typeof DEPARTMENT_SORT_KEYS)[number];

export interface DepartmentFilters {
  page?: number;
  limit?: number;
  sort?: DepartmentSortKey;
  order?: SortOrder;
  search?: string;
  parentId?: number;
  isActive?: boolean;
}

// --------------------------------------------------------------------------
// Positions
// --------------------------------------------------------------------------

export const POSITION_NAME_MAX_LENGTH = 150;
export const MIN_POSITION_LEVEL = 1;
export const MAX_POSITION_LEVEL = 5;
export const MAX_SALARY_VALUE = 9_999_999_999_999;

/** 1 Staff · 2 Senior · 3 Lead · 4 Manager · 5 Director. */
export const POSITION_LEVELS = [1, 2, 3, 4, 5] as const;
export type PositionLevel = (typeof POSITION_LEVELS)[number];

export interface DepartmentRef {
  id: number;
  name: string;
}

export interface Position {
  id: number;
  code: string;
  name: string;
  department: DepartmentRef;
  level: number;
  /** VNĐ as a plain number, or `null` when the range is not set. */
  minSalary: number | null;
  maxSalary: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PositionPayload {
  code: string;
  name: string;
  departmentId: number;
  level: number;
  minSalary?: number | null;
  maxSalary?: number | null;
  description?: string | null;
  isActive?: boolean;
}

export const POSITION_SORT_KEYS = ['code', 'name', 'level', 'createdAt'] as const;
export type PositionSortKey = (typeof POSITION_SORT_KEYS)[number];

export interface PositionFilters {
  page?: number;
  limit?: number;
  sort?: PositionSortKey;
  order?: SortOrder;
  search?: string;
  departmentId?: number;
  level?: number;
  isActive?: boolean;
}

// --------------------------------------------------------------------------
// Contract types — read-only, fixed by BLLĐ 2019 (`GET /contract-types`)
// --------------------------------------------------------------------------

export type ContractTypeValue = 'probation' | 'fixed_term' | 'indefinite' | 'seasonal';

export interface ContractType {
  value: ContractTypeValue | string;
  /** Vietnamese label supplied by the backend (already localised). */
  label: string;
  /** Legal basis, e.g. "Điều 20.1.b BLLĐ 2019 …". */
  description: string;
}

// --------------------------------------------------------------------------
// Leave types
// --------------------------------------------------------------------------

export const LEAVE_TYPE_NAME_MAX_LENGTH = 100;
export const MAX_DAYS_PER_YEAR = 366;
export const MIN_LEAVE_MIN_DAYS = 0.5;
export const MAX_SMALLINT = 32767;

export const LEAVE_GENDERS = ['all', 'female', 'male'] as const;
export type LeaveApplicableGender = (typeof LEAVE_GENDERS)[number];

export interface LeaveType {
  id: number;
  code: string;
  name: string;
  daysPerYear: number;
  isPaid: boolean;
  requireApproval: boolean;
  minDays: number;
  /** `null` = no cap on consecutive days. */
  maxConsecutive: number | null;
  advanceNoticeDays: number;
  applicableGender: LeaveApplicableGender | string;
  /** Legal citation (Điều … BLLĐ 2019 / Luật BHXH). */
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface LeaveTypePayload {
  code: string;
  name: string;
  daysPerYear: number;
  isPaid?: boolean;
  requireApproval?: boolean;
  minDays?: number;
  maxConsecutive?: number | null;
  advanceNoticeDays?: number;
  applicableGender?: LeaveApplicableGender;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

/** `GET /leave-types` is NOT paginated — it only takes these two filters. */
export interface LeaveTypeFilters {
  isActive?: boolean;
  applicableGender?: LeaveApplicableGender;
}

// --------------------------------------------------------------------------
// Holidays
// --------------------------------------------------------------------------

export const HOLIDAY_NAME_MAX_LENGTH = 100;
export const HOLIDAY_NOTE_MAX_LENGTH = 255;
export const MIN_HOLIDAY_YEAR = 1900;
export const MAX_HOLIDAY_YEAR = 2200;

export const HOLIDAY_TYPES = ['national', 'company', 'other'] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export interface Holiday {
  id: number;
  name: string;
  /** `YYYY-MM-DD`, unique across the whole table. */
  holidayDate: string;
  type: HolidayType | string;
  /** Derived by the backend from `holidayDate` — read-only, never sent. */
  year: number;
  isPaid: boolean;
  note: string | null;
}

/**
 * NOTE: there is deliberately NO "repeats annually" field. PLAN.md §2.2 says
 * "chọn ngày lặp lại hàng năm", but `holidays` stores one concrete date per row
 * (`holidayDate` is unique table-wide) and neither the entity nor the DTOs carry
 * a recurrence flag — Tết moves every year on the solar calendar, so a repeating
 * flag could not describe the Vietnamese holiday calendar anyway. Each year is
 * seeded/entered as its own row and filtered with `?year=`.
 */
export interface HolidayPayload {
  name: string;
  holidayDate: string;
  type?: HolidayType;
  isPaid?: boolean;
  note?: string | null;
}

export const HOLIDAY_SORT_KEYS = ['holidayDate', 'name', 'year'] as const;
export type HolidaySortKey = (typeof HOLIDAY_SORT_KEYS)[number];

export interface HolidayFilters {
  page?: number;
  limit?: number;
  sort?: HolidaySortKey;
  order?: SortOrder;
  year?: number;
  type?: HolidayType;
  isPaid?: boolean;
}

// --------------------------------------------------------------------------
// Shared
// --------------------------------------------------------------------------

export type SortOrder = 'asc' | 'desc';

/** DELETE responses: `{ success, data: { id, deleted } }`. */
export interface DeleteResult {
  id: number;
  deleted: boolean;
}
