import { apiClient } from '@/lib/axios';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api.types';
import type {
  AdjustLeaveBalancePayload,
  ApproveLeaveResult,
  CreateLeaveRequestPayload,
  DeleteLeaveResult,
  InitLeaveBalancePayload,
  InitLeaveBalanceResult,
  LeaveBalance,
  LeaveBalanceFilters,
  LeaveRequest,
  LeaveRequestFilters,
  UpdateLeaveRequestPayload,
} from '@/types/leave.types';

/**
 * Mọi call của module Nghỉ phép — nơi DUY NHẤT gọi `/leave-requests` và
 * `/leave-balances` (frontend/CLAUDE.md folder rule).
 *
 * `/leave-types` KHÔNG ở đây: nó là dữ liệu danh mục thuộc màn hình Cài đặt và
 * đã có `masterData.service.ts` phụ trách.
 *
 * KHÔNG CÓ ENDPOINT "CỦA TÔI". Nhân viên thường không đăng nhập hệ thống này;
 * đơn nghỉ do quản lý ghi nhận hộ và nhân sự duyệt.
 */

function toQuery(filters?: object): Record<string, string> | undefined {
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
  const { data } = await apiClient.get<ApiSuccessResponse<T>>(url, {
    params: toQuery(filters),
  });
  return data.data;
}

// -------------------------------------------------------------- quỹ phép ----

export function listLeaveBalances(
  filters?: LeaveBalanceFilters,
): Promise<PaginatedData<LeaveBalance>> {
  return get<PaginatedData<LeaveBalance>>('/leave-balances', filters);
}

/**
 * Cấp quỹ phép năm cho toàn bộ nhân viên đang làm việc.
 *
 * `dryRun` là bước xem trước: backend trả về đúng số sẽ tạo và số bị bỏ qua mà
 * không ghi gì. Đây là thao tác chạm vào cả công ty một lần, nên màn hình gọi
 * bước này trước.
 */
export async function initLeaveBalances(
  payload: InitLeaveBalancePayload,
): Promise<InitLeaveBalanceResult> {
  const { data } = await apiClient.post<
    ApiSuccessResponse<InitLeaveBalanceResult>
  >('/leave-balances/init', payload);
  return data.data;
}

export async function deleteLeaveBalance(
  id: number,
): Promise<{ id: number; deleted: boolean }> {
  const { data } = await apiClient.delete<
    ApiSuccessResponse<{ id: number; deleted: boolean }>
  >(`/leave-balances/${id}`);
  return data.data;
}

export async function adjustLeaveBalance(
  id: number,
  payload: AdjustLeaveBalancePayload,
): Promise<LeaveBalance> {
  const { data } = await apiClient.patch<ApiSuccessResponse<LeaveBalance>>(
    `/leave-balances/${id}`,
    payload,
  );
  return data.data;
}

// --------------------------------------------------------------- đơn nghỉ ----

export function listLeaveRequests(
  filters?: LeaveRequestFilters,
): Promise<PaginatedData<LeaveRequest>> {
  return get<PaginatedData<LeaveRequest>>('/leave-requests', filters);
}

/** Ai đang nghỉ trong khoảng ngày — chỉ đơn ĐÃ DUYỆT. */
export function listLeaveCalendar(
  from: string,
  to: string,
): Promise<LeaveRequest[]> {
  return get<LeaveRequest[]>('/leave-requests/calendar', { from, to });
}

export async function createLeaveRequest(
  payload: CreateLeaveRequestPayload,
): Promise<LeaveRequest> {
  const { data } = await apiClient.post<ApiSuccessResponse<LeaveRequest>>(
    '/leave-requests',
    payload,
  );
  return data.data;
}

export async function updateLeaveRequest(
  id: number,
  payload: UpdateLeaveRequestPayload,
): Promise<LeaveRequest> {
  const { data } = await apiClient.patch<ApiSuccessResponse<LeaveRequest>>(
    `/leave-requests/${id}`,
    payload,
  );
  return data.data;
}

export async function deleteLeaveRequest(
  id: number,
): Promise<DeleteLeaveResult> {
  const { data } = await apiClient.delete<ApiSuccessResponse<DeleteLeaveResult>>(
    `/leave-requests/${id}`,
  );
  return data.data;
}

export async function approveLeaveRequest(
  id: number,
): Promise<ApproveLeaveResult> {
  const { data } = await apiClient.patch<ApiSuccessResponse<ApproveLeaveResult>>(
    `/leave-requests/${id}/approve`,
    {},
  );
  return data.data;
}

export async function rejectLeaveRequest(
  id: number,
  reason: string,
): Promise<LeaveRequest> {
  const { data } = await apiClient.patch<ApiSuccessResponse<LeaveRequest>>(
    `/leave-requests/${id}/reject`,
    { reason },
  );
  return data.data;
}

export async function cancelLeaveRequest(id: number): Promise<LeaveRequest> {
  const { data } = await apiClient.patch<ApiSuccessResponse<LeaveRequest>>(
    `/leave-requests/${id}/cancel`,
    {},
  );
  return data.data;
}
