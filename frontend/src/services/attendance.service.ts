import { apiClient } from '@/lib/axios';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api.types';
import type {
  AttendanceFilters,
  AttendanceImportResult,
  AttendanceRecord,
  CreateOvertimePayload,
  MyAttendance,
  OvertimeFilters,
  OvertimeRequest,
  UpdateAttendancePayload,
} from '@/types/attendance.types';
import { filenameFromDisposition, type DownloadedFile } from '@/utils/download';
import { withJsonErrorBody } from './blobError';

/**
 * Mọi call của module Chấm công — nơi DUY NHẤT gọi `/attendances` và
 * `/overtime-requests` (frontend/CLAUDE.md folder rule).
 *
 * Hai nhóm endpoint nằm chung một file vì chúng là một màn hình nghiệp vụ:
 * đơn làm thêm giờ được đọc ngay trên bảng công tháng, và tách ra hai file chỉ
 * làm rải cùng bốn dòng axios sang chỗ khác. Bản xuất Excel thì KHÔNG ở đây —
 * nó thuộc `/reports`, xem `report.service.ts`.
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

// ------------------------------------------------------------ chấm công ----

/** Giờ do SERVER đọc — không có tham số thời gian, theo thiết kế của backend. */
export async function checkIn(note?: string): Promise<AttendanceRecord> {
  const { data } = await apiClient.post<ApiSuccessResponse<AttendanceRecord>>(
    '/attendances/check-in',
    { note },
  );
  return data.data;
}

export async function checkOut(note?: string): Promise<AttendanceRecord> {
  const { data } = await apiClient.post<ApiSuccessResponse<AttendanceRecord>>(
    '/attendances/check-out',
    { note },
  );
  return data.data;
}

export function getMyAttendance(query: {
  month?: number;
  year?: number;
}): Promise<MyAttendance> {
  return get<MyAttendance>('/attendances/me', query);
}

export function listAttendances(
  filters?: AttendanceFilters,
): Promise<PaginatedData<AttendanceRecord>> {
  return get<PaginatedData<AttendanceRecord>>('/attendances', filters);
}

export async function updateAttendance(
  id: number,
  payload: UpdateAttendancePayload,
): Promise<AttendanceRecord> {
  const { data } = await apiClient.patch<ApiSuccessResponse<AttendanceRecord>>(
    `/attendances/${id}`,
    payload,
  );
  return data.data;
}

// --------------------------------------------------------------- import ----

/**
 * Nạp file chấm công.
 *
 * `dryRun` là bước xem trước: backend trả về đúng con số sẽ tạo mới / ghi đè
 * mà không ghi gì. Màn hình import gọi nó trước, rồi mới gọi lần thật — người
 * dùng thấy "sẽ ghi đè 22 ngày công" TRƯỚC khi việc đó xảy ra.
 */
export async function importAttendances(
  file: File,
  options: { dryRun: boolean },
): Promise<AttendanceImportResult> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await apiClient.post<ApiSuccessResponse<AttendanceImportResult>>(
    '/attendances/bulk-import',
    form,
    { params: { dryRun: String(options.dryRun) } },
  );

  return data.data;
}

/** File Excel mẫu — tên cột sai là cách hỏng phổ biến nhất của import. */
export async function downloadImportTemplate(): Promise<DownloadedFile> {
  try {
    const response = await apiClient.get<Blob>('/attendances/import-template', {
      responseType: 'blob',
    });

    return {
      blob: response.data,
      filename: filenameFromDisposition(
        response.headers['content-disposition'] as string | undefined,
        'mau-nhap-cham-cong.xlsx',
      ),
    };
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}

// ------------------------------------------------------------- overtime ----

export function listOvertimeRequests(
  filters?: OvertimeFilters,
): Promise<PaginatedData<OvertimeRequest>> {
  return get<PaginatedData<OvertimeRequest>>('/overtime-requests', filters);
}

export async function createOvertimeRequest(
  payload: CreateOvertimePayload,
): Promise<OvertimeRequest> {
  const { data } = await apiClient.post<ApiSuccessResponse<OvertimeRequest>>(
    '/overtime-requests',
    payload,
  );
  return data.data;
}

export async function approveOvertimeRequest(id: number): Promise<OvertimeRequest> {
  const { data } = await apiClient.patch<ApiSuccessResponse<OvertimeRequest>>(
    `/overtime-requests/${id}/approve`,
    {},
  );
  return data.data;
}

export async function rejectOvertimeRequest(
  id: number,
  reason: string,
): Promise<OvertimeRequest> {
  const { data } = await apiClient.patch<ApiSuccessResponse<OvertimeRequest>>(
    `/overtime-requests/${id}/reject`,
    { reason },
  );
  return data.data;
}

export async function cancelOvertimeRequest(id: number): Promise<OvertimeRequest> {
  const { data } = await apiClient.patch<ApiSuccessResponse<OvertimeRequest>>(
    `/overtime-requests/${id}/cancel`,
    {},
  );
  return data.data;
}
