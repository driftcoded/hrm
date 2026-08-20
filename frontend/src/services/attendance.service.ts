import { apiClient } from '@/lib/axios';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api.types';
import type {
  AttendanceFilters,
  AttendanceImportResult,
  AttendanceRecord,
  AttendanceStats,
  AttendanceStatsFilters,
  CreateAttendancePayload,
  UpdateAttendancePayload,
} from '@/types/attendance.types';
import { filenameFromDisposition, type DownloadedFile } from '@/utils/download';
import { withJsonErrorBody } from './blobError';

/**
 * Mọi call của module Chấm công — nơi DUY NHẤT gọi `/attendances`
 * (frontend/CLAUDE.md folder rule). Bản xuất Excel thì KHÔNG ở đây — nó thuộc
 * `/reports`, xem `report.service.ts`.
 *
 * KHÔNG CÓ ĐƠN LÀM THÊM GIỜ. Giờ làm thêm suy ra từ chính giờ vào/ra (phần vượt
 * 8 giờ/ngày, hoặc toàn bộ thời gian nếu là ngày nghỉ tuần/ngày lễ) và về theo
 * `AttendanceRecord.overtimeHours` — không có endpoint đăng ký/duyệt nào cả.
 *
 * KHÔNG CÓ CHẤM CÔNG TỰ ĐỘNG. Việc chấm công diễn ra trên nền tảng ngoài; dữ
 * liệu vào hệ thống bằng `importAttendances` (Excel, đường chính) hoặc
 * `createAttendance` (gõ tay từng dòng). Nhân viên thường không đăng nhập hệ
 * thống này nên không có endpoint nào "của tôi".
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

/**
 * Nhập tay một ngày công.
 *
 * Không có `checkIn`/`checkOut` tự chấm công: hệ thống không làm việc đó — xem
 * ghi chú đầu file.
 */
export async function createAttendance(
  payload: CreateAttendancePayload,
): Promise<AttendanceRecord> {
  const { data } = await apiClient.post<ApiSuccessResponse<AttendanceRecord>>(
    '/attendances',
    payload,
  );
  return data.data;
}

export function listAttendances(
  filters?: AttendanceFilters,
): Promise<PaginatedData<AttendanceRecord>> {
  return get<PaginatedData<AttendanceRecord>>('/attendances', filters);
}

/** Số liệu cho biểu đồ chấm công — một lần gọi trả cả tháng. */
export function getAttendanceStats(
  filters?: AttendanceStatsFilters,
): Promise<AttendanceStats> {
  return get<AttendanceStats>('/attendances/stats', filters);
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

