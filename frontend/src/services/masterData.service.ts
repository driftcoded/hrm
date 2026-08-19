import { apiClient } from '@/lib/axios';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api.types';
import type {
  ContractType,
  DeleteResult,
  Department,
  DepartmentFilters,
  DepartmentPayload,
  DepartmentTreeNode,
  Holiday,
  HolidayFilters,
  HolidayPayload,
  LeaveType,
  LeaveTypeFilters,
  LeaveTypePayload,
  Position,
  PositionFilters,
  PositionPayload,
  Province,
  Ward,
} from '@/types/masterData.types';

/**
 * Master-data API calls — the ONLY place allowed to talk to `/departments`,
 * `/positions`, `/contract-types`, `/leave-types` and `/holidays`
 * (frontend/CLAUDE.md folder rule).
 *
 * The five entities share one file because they are one feature area (the
 * Settings section) with identical plumbing; splitting them into five 30-line
 * files would spread the same three lines of axios across the folder without
 * making anything easier to find.
 *
 * Two contract details every caller depends on:
 *   - `/departments`, `/positions`, `/holidays` are paginated (`{items, meta}`);
 *     `/leave-types`, `/contract-types` and `/departments/tree` return PLAIN
 *     ARRAYS. The return types below say which is which.
 *   - `undefined` filter values are dropped before the request. Sending
 *     `?search=` or `?isActive=` empty makes the backend's ValidationPipe reject
 *     the call, so the query builder below never emits an empty param.
 */

/**
 * Only defined, non-empty values reach the query string. Booleans go out as
 * `"true"`/`"false"` — the backend's `@IsBooleanValue()` accepts those.
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
// Departments
// -------------------------------------------------------------------------

export function listDepartments(filters?: DepartmentFilters): Promise<PaginatedData<Department>> {
  return get<PaginatedData<Department>>('/departments', filters);
}

/**
 * Nested tree of root departments, each with `children`. The endpoint ignores
 * pagination and filters entirely, so it takes no arguments — a department whose
 * parent was soft-deleted is promoted to a root by the backend so nothing
 * silently disappears from the tree.
 */
export function listDepartmentTree(): Promise<DepartmentTreeNode[]> {
  return get<DepartmentTreeNode[]>('/departments/tree');
}

export function createDepartment(payload: DepartmentPayload): Promise<Department> {
  return post<Department>('/departments', payload);
}

export function updateDepartment(
  id: number,
  payload: Partial<DepartmentPayload>,
): Promise<Department> {
  return patch<Department>(`/departments/${id}`, payload);
}

export function deleteDepartment(id: number): Promise<DeleteResult> {
  return del(`/departments/${id}`);
}

// -------------------------------------------------------------------------
// Positions
// -------------------------------------------------------------------------

export function listPositions(filters?: PositionFilters): Promise<PaginatedData<Position>> {
  return get<PaginatedData<Position>>('/positions', filters);
}

export function createPosition(payload: PositionPayload): Promise<Position> {
  return post<Position>('/positions', payload);
}

export function updatePosition(id: number, payload: Partial<PositionPayload>): Promise<Position> {
  return patch<Position>(`/positions/${id}`, payload);
}

export function deletePosition(id: number): Promise<DeleteResult> {
  return del(`/positions/${id}`);
}

// -------------------------------------------------------------------------
// Contract types — read-only (no write endpoints exist)
// -------------------------------------------------------------------------

export function listContractTypes(): Promise<ContractType[]> {
  return get<ContractType[]>('/contract-types');
}

// -------------------------------------------------------------------------
// Leave types — plain array, only `isActive` / `applicableGender` filters
// -------------------------------------------------------------------------

export function listLeaveTypes(filters?: LeaveTypeFilters): Promise<LeaveType[]> {
  return get<LeaveType[]>('/leave-types', filters);
}

export function createLeaveType(payload: LeaveTypePayload): Promise<LeaveType> {
  return post<LeaveType>('/leave-types', payload);
}

export function updateLeaveType(id: number, payload: Partial<LeaveTypePayload>): Promise<LeaveType> {
  return patch<LeaveType>(`/leave-types/${id}`, payload);
}

export function deleteLeaveType(id: number): Promise<DeleteResult> {
  return del(`/leave-types/${id}`);
}

// -------------------------------------------------------------------------
// Holidays
// -------------------------------------------------------------------------

export function listHolidays(filters?: HolidayFilters): Promise<PaginatedData<Holiday>> {
  return get<PaginatedData<Holiday>>('/holidays', filters);
}

export function createHoliday(payload: HolidayPayload): Promise<Holiday> {
  return post<Holiday>('/holidays', payload);
}

export function updateHoliday(id: number, payload: Partial<HolidayPayload>): Promise<Holiday> {
  return patch<Holiday>(`/holidays/${id}`, payload);
}

export function deleteHoliday(id: number): Promise<DeleteResult> {
  return del(`/holidays/${id}`);
}

// -------------------------------------------------------------------------
// Provinces (static reference data)
// -------------------------------------------------------------------------

/**
 * The 34 provinces/cities. A plain array, not paginated, and immutable for the
 * life of the server process — callers cache it aggressively.
 */
export function listProvinces(): Promise<Province[]> {
  return get<Province[]>('/system/provinces');
}

/**
 * Wards of one province. `provinceCode` is effectively required: omitting it
 * returns all 3,321 units in the country, which no screen wants.
 */
export function listWards(provinceCode: string): Promise<Ward[]> {
  return get<Ward[]>('/system/wards', { provinceCode });
}
