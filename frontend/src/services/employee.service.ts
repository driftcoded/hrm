import { apiClient } from '@/lib/axios';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api.types';
import type { DeleteResult } from '@/types/masterData.types';
import type {
  AvatarUploadResult,
  Contract,
  ContractFilters,
  CreateContractPayload,
  CreateDependentPayload,
  CreateEmployeePayload,
  CreatedUser,
  CreateUserPayload,
  EmployeeDetail,
  EmployeeFilters,
  EmployeeListItem,
  EmployeePickerItem,
  EmployeeSearchFilters,
  Dependent,
  EmployeeStats,
  FamilyMember,
  FamilyMemberPayload,
  RestoreResult,
  RoleOption,
  TerminateContractPayload,
  UpdateContractPayload,
  UpdateDependentPayload,
  UpdateEmployeePayload,
} from '@/types/employee.types';

/**
 * Every call the Employees module makes — the ONLY place allowed to talk to
 * `/employees`, `/contracts`, `/roles` and `/users`
 * (frontend/CLAUDE.md folder rule).
 *
 * One file for the whole module because contracts and family members are not
 * separate features: they are tabs on an employee record, reached through the
 * employee's id, and splitting them into three files would scatter the same
 * four axios lines without making anything easier to find. It mirrors
 * `masterData.service.ts`, which does the same for the five Settings entities.
 *
 * Two contract details every caller depends on:
 *   - `/employees` and `/contracts` are paginated (`{items, meta}`);
 *     `/employees/:id/family-members`, `/employees/stats` and `/roles` return a
 *     plain object or array. The return types below say which is which.
 *   - `undefined` / `''` filter values are dropped before the request: the
 *     backend validates with `whitelist: true` and 400s on an empty `?status=`.
 */

function toQuery(filters: object | undefined): Record<string, string> | undefined {
  if (!filters) {
    return undefined;
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params[key] = String(value);
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

async function get<T>(url: string, filters?: object): Promise<T> {
  const { data } = await apiClient.get<ApiSuccessResponse<T>>(url, { params: toQuery(filters) });
  return data.data;
}

async function post<T>(url: string, payload: unknown): Promise<T> {
  const { data } = await apiClient.post<ApiSuccessResponse<T>>(url, payload);
  return data.data;
}

async function patch<T>(url: string, payload: unknown): Promise<T> {
  const { data } = await apiClient.patch<ApiSuccessResponse<T>>(url, payload);
  return data.data;
}

async function del(url: string): Promise<DeleteResult> {
  const { data } = await apiClient.delete<ApiSuccessResponse<DeleteResult>>(url);
  return data.data;
}

// -------------------------------------------------------------------------
// Employees
// -------------------------------------------------------------------------

export function listEmployees(filters?: EmployeeFilters): Promise<PaginatedData<EmployeeListItem>> {
  return get<PaginatedData<EmployeeListItem>>('/employees', filters);
}

export function getEmployee(id: number): Promise<EmployeeDetail> {
  return get<EmployeeDetail>(`/employees/${id}`);
}

/** The signed-in user's own record — the only employee route `employee` may call. */
export function getMyEmployee(): Promise<EmployeeDetail> {
  return get<EmployeeDetail>('/employees/me');
}

/**
 * Every number behind the overview tiles and the right-hand rail, in ONE call.
 *
 * Counting client-side is not an option: each figure is a COUNT over the whole
 * table, and the list endpoint only ever returns one page of at most 100 rows.
 */
export function getEmployeeStats(): Promise<EmployeeStats> {
  return get<EmployeeStats>('/employees/stats');
}

export function createEmployee(payload: CreateEmployeePayload): Promise<EmployeeDetail> {
  return post<EmployeeDetail>('/employees', payload);
}

export function updateEmployee(
  id: number,
  payload: UpdateEmployeePayload,
): Promise<EmployeeDetail> {
  return patch<EmployeeDetail>(`/employees/${id}`, payload);
}

/** Soft delete — the record stays in the database and can be restored. */
export function deleteEmployee(id: number): Promise<DeleteResult> {
  return del(`/employees/${id}`);
}

export function restoreEmployee(id: number): Promise<RestoreResult> {
  return post<RestoreResult>(`/employees/${id}/restore`, {});
}

/**
 * Avatar upload.
 *
 * `Content-Type` is deliberately NOT set: the browser must add the multipart
 * boundary itself, and naming the type by hand produces a body the server
 * cannot parse. The server validates size and real file type (magic bytes), so
 * a rejected file comes back as a normal API error the caller can render.
 */
export async function uploadEmployeeAvatar(id: number, file: File): Promise<AvatarUploadResult> {
  const form = new FormData();
  form.append('avatar', file);

  const { data } = await apiClient.post<ApiSuccessResponse<AvatarUploadResult>>(
    `/employees/${id}/avatar`,
    form,
  );

  return data.data;
}

/** Narrow search used by the `/settings/departments` manager picker. */
export function searchEmployees(
  filters: EmployeeSearchFilters = {},
): Promise<PaginatedData<EmployeePickerItem>> {
  return get<PaginatedData<EmployeePickerItem>>('/employees', filters);
}

// -------------------------------------------------------------------------
// Contracts
// -------------------------------------------------------------------------

export function listContracts(filters?: ContractFilters): Promise<PaginatedData<Contract>> {
  return get<PaginatedData<Contract>>('/contracts', filters);
}

export function createContract(payload: CreateContractPayload): Promise<Contract> {
  return post<Contract>('/contracts', payload);
}

export function updateContract(id: number, payload: UpdateContractPayload): Promise<Contract> {
  return patch<Contract>(`/contracts/${id}`, payload);
}

/**
 * End a signed contract. Separate from `updateContract` because the server sets
 * status, date and reason together — a signed contract is a legal record, so it
 * is terminated, never edited into a different state.
 */
export function terminateContract(
  id: number,
  payload: TerminateContractPayload,
): Promise<Contract> {
  return patch<Contract>(`/contracts/${id}/terminate`, payload);
}

/** Only a `draft` contract can be deleted; the server 422s on anything signed. */
export function deleteContract(id: number): Promise<DeleteResult> {
  return del(`/contracts/${id}`);
}

// -------------------------------------------------------------------------
// Family members (nested under an employee)
// -------------------------------------------------------------------------

export function listFamilyMembers(employeeId: number): Promise<FamilyMember[]> {
  return get<FamilyMember[]>(`/employees/${employeeId}/family-members`);
}

export function createFamilyMember(
  employeeId: number,
  payload: FamilyMemberPayload,
): Promise<FamilyMember> {
  return post<FamilyMember>(`/employees/${employeeId}/family-members`, payload);
}

export function updateFamilyMember(
  employeeId: number,
  memberId: number,
  payload: Partial<FamilyMemberPayload>,
): Promise<FamilyMember> {
  return patch<FamilyMember>(`/employees/${employeeId}/family-members/${memberId}`, payload);
}

export function deleteFamilyMember(employeeId: number, memberId: number): Promise<DeleteResult> {
  return del(`/employees/${employeeId}/family-members/${memberId}`);
}


// -------------------------------------------------------------------------
// Dependents (nested under an employee) — tax deduction register
// -------------------------------------------------------------------------

export function listDependents(employeeId: number): Promise<Dependent[]> {
  return get<Dependent[]>(`/employees/${employeeId}/dependents`);
}

export function createDependent(
  employeeId: number,
  payload: CreateDependentPayload,
): Promise<Dependent> {
  return post<Dependent>(`/employees/${employeeId}/dependents`, payload);
}

export function updateDependent(
  employeeId: number,
  dependentId: number,
  payload: UpdateDependentPayload,
): Promise<Dependent> {
  return patch<Dependent>(`/employees/${employeeId}/dependents/${dependentId}`, payload);
}

/**
 * Permanent — `dependents` has no soft-delete column. To STOP a deduction while
 * keeping the history, PATCH `status: 'inactive'` with a reason instead.
 */
export function deleteDependent(
  employeeId: number,
  dependentId: number,
): Promise<DeleteResult> {
  return del(`/employees/${employeeId}/dependents/${dependentId}`);
}

// -------------------------------------------------------------------------
// Login account — the create wizard's last step
// -------------------------------------------------------------------------

export function listRoles(): Promise<RoleOption[]> {
  return get<RoleOption[]>('/roles');
}

/**
 * An employee record and a login account are two different rows
 * (`users.employee_id` links them), so creating staff is two calls. Only
 * `admin` may make this one — the wizard hides the step for everyone else.
 */
export function createUser(payload: CreateUserPayload): Promise<CreatedUser> {
  return post<CreatedUser>('/users', payload);
}
