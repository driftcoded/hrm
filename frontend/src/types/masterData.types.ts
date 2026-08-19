/**
 * Master-data types — departments, positions, contract types, leave types and
 * holidays (Giai đoạn 2.2).
 *
 * Every shape here was verified against the RUNNING backend, not only the DTO
 * source, because a few response fields differ from what the request accepts:
 *
 *   - a department response carries `manager: { id, fullName } | null` plus the
 *     derived `employeeCount` and `positionCount`, while create/update take a
 *     flat `managerId` and no counts at all;
 *   - a position response carries `department: { id, name }`, while
 *     create/update take a flat `departmentId`;
 *   - a holiday response carries a derived `year` — never send it, the backend
 *     computes it from `holidayDate`;
 *   - `GET /leave-types` returns a PLAIN ARRAY (no pagination envelope).
 *
 * CODES ARE READ-ONLY. `code` is on every response row below and on none of the
 * `*Payload` types: the server generates it (`PB0001` for a department, `CV0001`
 * for a position, `NP0001` for a leave type) and never accepts one. The create
 * and update DTOs dropped the field, and the API validates with
 * `whitelist: true`, so a `code` sent anyway is silently discarded rather than
 * honoured — which is why it is absent from the payload types instead of merely
 * unused: a future caller cannot reintroduce a field that would be ignored.
 *
 * The `MAX_*` constants mirror the backend validators so the form can reject
 * obvious mistakes before a round trip. The backend stays the authority — these
 * only save the user a failed request.
 */

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
  /**
   * Positions defined inside this department — batched server-side, so it costs
   * no extra request. Also the reason a delete can be refused with
   * `DEPARTMENT_HAS_POSITIONS`.
   */
  positionCount: number;
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

// --------------------------------------------------------------------------
// Provinces — static reference data (`GET /system/provinces`)
// --------------------------------------------------------------------------

/**
 * One of the 34 provinces/cities (post-2025 merger).
 *
 * Served from a JSON file bundled with the backend, NOT a database table: the
 * 26-table schema has no province/district/ward tables, and `employees` stores
 * the three codes as plain text (scope decision from Giai đoạn 0.1).
 *
 * There is deliberately no `District` type and never will be: Vietnam abolished
 * the district tier on 01/07/2025 (Law 72/2025/QH15).
 */
export interface Province {
  /** Mã BNV mới, "01"–"34" (sau sáp nhập 01/07/2025). */
  code: string;
  name: string;
  type: string;
  /** Mã tỉnh trong hệ thống thuế, ví dụ "101". */
  tmsCode: string;
}

/**
 * Một phường/xã/đặc khu — cấp hành chính thứ hai và CUỐI CÙNG.
 *
 * Cấp huyện đã chấm dứt hoạt động từ 01/07/2025 (Luật 72/2025/QH15), nên không
 * có `District` ở đây và sẽ không bao giờ có. `legacyDistrict*` chỉ để đọc/đối
 * chiếu hồ sơ tuyển trước mốc đó.
 */
export interface Ward {
  /** Mã hệ thống thuế (TMS), ví dụ "10105001". */
  code: string;
  name: string;
  provinceCode: string;
  type: 'phuong' | 'xa' | 'dac_khu';
  legacyDistrictCode: string;
  legacyDistrictName: string;
}
