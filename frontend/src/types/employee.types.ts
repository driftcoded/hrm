/**
 * The Employees module contract — `GET/POST/PATCH/DELETE /employees`,
 * `/contracts`, `/employees/:id/family-members`, plus `/employees/stats` and
 * the `/users` + `/roles` calls the create wizard's last step needs.
 *
 * HISTORY — this file used to describe ONE dropdown. Giai đoạn 2.2 needed a
 * "pick a manager" field on `/settings/departments` and nothing else, so the
 * file deliberately declared four fields and carried a warning not to grow it
 * until the Employees module arrived with its own screens. It has now arrived
 * (Giai đoạn 3.2), so the warning is spent and this is the real model.
 * `EmployeePickerItem` is kept as a narrow VIEW of `EmployeeListItem` so the
 * departments picker keeps compiling unchanged.
 *
 * Money is `number` VNĐ (api-spec.md §1.5), dates are `YYYY-MM-DD` strings and
 * timestamps are ISO-8601 (§1.4) — exactly what the API sends, with no parsing
 * in between.
 */

// ---------------------------------------------------------------- enums ---

export const EMPLOYEE_STATUSES = [
  'probation',
  'active',
  'on_leave',
  'suspended',
  'resigned',
  'terminated',
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const EDUCATION_LEVELS = [
  'high_school',
  'college',
  'university',
  'master',
  'phd',
  'other',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const TERMINATION_TYPES = [
  'resigned',
  'fired',
  'contract_ended',
  'retired',
  'deceased',
] as const;
export type TerminationType = (typeof TERMINATION_TYPES)[number];

export const CONTRACT_TYPES = ['probation', 'fixed_term', 'indefinite', 'seasonal'] as const;
export type ContractTypeValue = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const DEPENDENT_RELATIONSHIPS = [
  'child',
  'spouse',
  'parent',
  'sibling',
  'other',
] as const;
export type DependentRelationship = (typeof DEPENDENT_RELATIONSHIPS)[number];

export const DEPENDENT_STATUSES = ['active', 'inactive'] as const;
export type DependentStatus = (typeof DEPENDENT_STATUSES)[number];

export const FAMILY_RELATIONSHIPS = [
  'spouse',
  'father',
  'mother',
  'child',
  'sibling',
  'other',
] as const;
export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number];

/** Columns the server accepts in `?sort=` — anything else is a 400. */
export const EMPLOYEE_SORT_KEYS = [
  'employeeCode',
  'fullName',
  'hireDate',
  'status',
  'createdAt',
] as const;
export type EmployeeSortKey = (typeof EMPLOYEE_SORT_KEYS)[number];

// ------------------------------------------------------------- employee ---

/** `{ id, name }` for a department / position / manager reference. */
export interface EmployeeRef {
  id: number;
  name: string;
}

/** One row of `GET /employees`. */
export interface EmployeeListItem {
  id: number;
  /** Server-generated, e.g. `NV0001`. Never sent by the client. */
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  gender: Gender;
  dateOfBirth: string;
  department: EmployeeRef | null;
  position: EmployeeRef | null;
  status: EmployeeStatus;
  hireDate: string;
  avatarUrl: string | null;
  /** From the active contract; `null` when the employee has none yet. */
  baseSalary: number | null;
  /** Only non-null in the `?onlyDeleted=true` (trash) listing. */
  deletedAt: string | null;
}

/**
 * `GET /employees/:id`.
 *
 * NOTE the asymmetry with `EmployeeListItem`: the list response deliberately
 * omits CCCD and bank details, so those fields exist ONLY here. A component
 * that needs them must be on the detail screen, not the table.
 */
export interface EmployeeDetail extends EmployeeListItem {
  lastName: string;
  firstName: string;
  maritalStatus: MaritalStatus;
  nationality: string;
  ethnicity: string;
  religion: string | null;
  placeOfBirth: string;
  hometown: string;
  cccdNumber: string;
  cccdIssueDate: string;
  cccdIssuePlace: string;
  cccdExpiredDate: string | null;
  taxCode: string | null;
  socialInsuranceNo: string | null;
  healthInsuranceNo: string | null;
  healthInsuranceExp: string | null;
  permanentAddress: string;
  currentAddress: string | null;
  provinceCode: string;
  /** `null` với hồ sơ tạo sau 01/07/2025 — cấp huyện đã bị bỏ. */
  districtCode: string | null;
  wardCode: string;
  personalEmail: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRel: string | null;
  bankAccount: string | null;
  bankName: string | null;
  bankBranch: string | null;
  directManager: EmployeeRef | null;
  probationStartDate: string | null;
  probationEndDate: string | null;
  officialStartDate: string | null;
  terminationDate: string | null;
  terminationReason: string | null;
  terminationType: TerminationType | null;
  educationLevel: EducationLevel | null;
  major: string | null;
  university: string | null;
  graduationYear: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeFilters {
  page?: number;
  limit?: number;
  sort?: EmployeeSortKey;
  order?: 'asc' | 'desc';
  /** Matches full name, employee code, email or CCCD on the server. */
  search?: string;
  departmentId?: number;
  positionId?: number;
  status?: EmployeeStatus;
  gender?: Gender;
  hireFrom?: string;
  hireTo?: string;
  /** `true` lists ONLY soft-deleted records — the restore screen. */
  onlyDeleted?: boolean;
}

/**
 * `POST /employees`. `employeeCode` and `fullName` are absent on purpose: the
 * server generates the code and composes the full name from last + first, so
 * sending either would be ignored at best.
 */
export interface CreateEmployeePayload {
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  gender: Gender;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  ethnicity?: string;
  religion?: string | null;
  placeOfBirth: string;
  hometown: string;
  cccdNumber: string;
  cccdIssueDate: string;
  cccdIssuePlace: string;
  cccdExpiredDate?: string | null;
  taxCode?: string | null;
  socialInsuranceNo?: string | null;
  healthInsuranceNo?: string | null;
  healthInsuranceExp?: string | null;
  permanentAddress: string;
  currentAddress?: string | null;
  /** Mã BNV "01"–"34". */
  provinceCode: string;
  /**
   * ⚠️ Cấp huyện đã bị bỏ từ 01/07/2025 (Luật 72/2025/QH15). Chỉ gửi khi nhập
   * liệu hồ sơ CŨ; hồ sơ mới bỏ trống.
   */
  districtCode?: string | null;
  /** Mã phường/xã/đặc khu theo hệ thống thuế, ví dụ "10105001". */
  wardCode: string;
  phone: string;
  email: string;
  personalEmail?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRel?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  positionId: number;
  departmentId: number;
  directManagerId?: number | null;
  hireDate: string;
  probationStartDate?: string | null;
  probationEndDate?: string | null;
  officialStartDate?: string | null;
  status?: EmployeeStatus;
  educationLevel?: EducationLevel | null;
  major?: string | null;
  university?: string | null;
  graduationYear?: number | null;
  notes?: string | null;
}

/** `PATCH /employees/:id` — every field optional, plus the termination trio. */
export type UpdateEmployeePayload = Partial<CreateEmployeePayload> & {
  terminationDate?: string | null;
  terminationReason?: string | null;
  terminationType?: TerminationType | null;
};

export interface RestoreResult {
  id: number;
  restored: boolean;
}

export interface AvatarUploadResult {
  avatarUrl: string;
}

// ---------------------------------------------------------------- stats ---

export interface DepartmentHeadcount {
  departmentId: number;
  departmentName: string;
  count: number;
}

export interface UpcomingBirthday {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  avatarUrl: string | null;
  /** `MM-DD` — the year is meaningless for a birthday reminder. */
  birthday: string;
  daysUntil: number;
}

/**
 * `GET /employees/stats`.
 *
 * There is no "vs last month" figure anywhere in here, by design: the
 * `employees` table stores current state only, so the server cannot derive last
 * month's headcount honestly. `hiredLast30Days` is the one real trend number
 * (it comes from `hire_date`), and the UI must not imply any other.
 */
export interface EmployeeStats {
  total: number;
  byStatus: Record<EmployeeStatus, number>;
  contractsExpiringSoon: number;
  /** Window used by `contractsExpiringSoon` / `probationEndingSoon` / birthdays. */
  windowDays: number;
  hiredLast30Days: number;
  probationEndingSoon: number;
  byGender: { male: number; female: number; other: number };
  averageAge: number | null;
  averageTenureYears: number | null;
  byDepartment: DepartmentHeadcount[];
  upcomingBirthdays: UpcomingBirthday[];
}

// ------------------------------------------------------------- contracts ---

export interface ContractEmployeeRef {
  id: number;
  employeeCode: string;
  fullName: string;
}

export interface Contract {
  id: number;
  employee: ContractEmployeeRef | null;
  contractNumber: string;
  contractType: ContractTypeValue;
  startDate: string;
  endDate: string | null;
  signDate: string;
  baseSalary: number;
  insuranceSalary: number;
  positionAllowance: number;
  otherAllowance: number;
  workingHours: number;
  workingDays: number;
  probationSalaryPct: number | null;
  status: ContractStatus;
  terminatedDate: string | null;
  terminatedReason: string | null;
  fileUrl: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractFilters {
  page?: number;
  limit?: number;
  employeeId?: number;
  status?: ContractStatus;
  contractType?: ContractTypeValue;
  /** Contracts expiring within N days — the server caps this at 365. */
  expiringDays?: number;
}

export interface CreateContractPayload {
  employeeId: number;
  contractNumber: string;
  contractType: ContractTypeValue;
  startDate: string;
  endDate?: string | null;
  signDate: string;
  baseSalary: number;
  insuranceSalary: number;
  positionAllowance?: number;
  otherAllowance?: number;
  workingHours?: number;
  workingDays?: number;
  probationSalaryPct?: number | null;
  /** Only `draft` or `active` are accepted; the other two are lifecycle results. */
  status?: Extract<ContractStatus, 'draft' | 'active'>;
  fileUrl?: string | null;
  note?: string | null;
}

/** `employeeId` is not updatable — a contract belongs to whoever signed it. */
export type UpdateContractPayload = Partial<Omit<CreateContractPayload, 'employeeId'>>;

export interface TerminateContractPayload {
  terminatedDate: string;
  terminatedReason: string;
  note?: string | null;
}

// --------------------------------------------------------- family members ---

export interface FamilyMember {
  id: number;
  employeeId: number;
  fullName: string;
  relationship: FamilyRelationship;
  dateOfBirth: string | null;
  occupation: string | null;
  phone: string | null;
  cccdNumber: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMemberPayload {
  fullName: string;
  relationship: FamilyRelationship;
  dateOfBirth?: string | null;
  occupation?: string | null;
  phone?: string | null;
  cccdNumber?: string | null;
  note?: string | null;
}

// ------------------------------------------------------------- dependents ---

/**
 * Người phụ thuộc — the family-circumstance tax deduction register
 * (Article 19, Personal Income Tax Law).
 *
 * NOT the same thing as `FamilyMember`, despite the overlap in people. That one
 * is an HR note about the household; this one has money attached — each active
 * dependent lowers the employee's taxable income by 6.2M ₫/month (rate from
 * 01/01/2026). Hence the extra fields: a registration date, an end date, and a
 * reason when the deduction stops.
 */
export interface Dependent {
  id: number;
  employeeId: number;
  fullName: string;
  relationship: DependentRelationship;
  dateOfBirth: string;
  cccdNumber: string | null;
  taxCode: string | null;
  /** When the deduction starts counting. */
  registrationDate: string;
  endDate: string | null;
  status: DependentStatus;
  reasonInactive: string | null;
  documentUrl: string | null;
  note: string | null;
  /**
   * Whether the deduction applies TODAY (active + inside the date window).
   *
   * A convenience for the UI only. Payroll works month by month, so phase 6
   * must compute eligibility for the month being paid rather than reading this.
   */
  isCurrentlyDeductible: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `status` is absent: a dependent is always `active` when first registered. */
export interface CreateDependentPayload {
  fullName: string;
  relationship: DependentRelationship;
  dateOfBirth: string;
  cccdNumber?: string | null;
  taxCode?: string | null;
  registrationDate: string;
  endDate?: string | null;
  documentUrl?: string | null;
  note?: string | null;
}

/** Stopping the deduction requires a reason — the server enforces it. */
export type UpdateDependentPayload = Partial<CreateDependentPayload> & {
  status?: DependentStatus;
  reasonInactive?: string | null;
};

// --------------------------------------------- login account (wizard step 4) ---

export interface RoleOption {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  roleId: number;
  employeeId?: number | null;
}

export interface CreatedUser {
  id: number;
  username: string;
  email: string;
  employeeId: number | null;
  status: string;
}

// ------------------------------------------------------ department picker ---

/**
 * The four fields the `/settings/departments` manager dropdown renders.
 *
 * A structural subset of `EmployeeListItem`, so `GET /employees` results are
 * assignable to it and the picker needs no mapping. `department` stays optional
 * because that picker must survive the field disappearing from the payload.
 */
export interface EmployeePickerItem {
  id: number;
  employeeCode: string;
  fullName: string;
  department?: EmployeeRef | null;
}

export interface EmployeeSearchFilters {
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * How many people one dropdown shows. A picker is for finding a known person by
 * typing their name, not for browsing staff, so this is a short list that keeps
 * the response small; a name that is not in it is found by typing more.
 */
export const EMPLOYEE_SEARCH_LIMIT = 20;
