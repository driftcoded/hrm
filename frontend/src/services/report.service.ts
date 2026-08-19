import { apiClient } from '@/lib/axios';
import type { EmployeeFilters } from '@/types/employee.types';
import { filenameFromDisposition, type DownloadedFile } from '@/utils/download';
import { withJsonErrorBody } from './blobError';

/**
 * Mọi call tới `/reports` — hiện chỉ có bản xuất Excel danh sách nhân viên,
 * sẽ có thêm báo cáo chấm công/lương ở Giai đoạn 4–6.
 *
 * Tách khỏi `employee.service.ts` vì file đó tự khai là nơi DUY NHẤT gọi
 * `/employees`, `/contracts`, `/roles`, `/users`; `/reports` là module khác
 * ở backend và có phân quyền riêng, nên trộn vào đó là làm sai chính câu
 * ghi chú đầu file kia.
 */

/** Tên dùng khi server không gửi `Content-Disposition` (ví dụ qua proxy lạ). */
const EXPORT_FALLBACK_FILENAME = 'employees.xlsx';

/**
 * `GET /reports/employees/export` → file .xlsx.
 *
 * Nhận CÙNG bộ filter với màn hình danh sách, trừ `page`/`limit`: bản xuất
 * không phân trang, gửi kèm chỉ khiến URL nói sai về thứ đang yêu cầu (backend
 * cũng bỏ qua chúng). `sort`/`order` thì GIỮ — người dùng sắp xếp bảng theo
 * cột nào thì file phải ra theo đúng thứ tự đó.
 *
 * KHÔNG truyền `includeSensitive`: bản xuất từ giao diện luôn là bản đã che
 * CCCD/số tài khoản và ẩn các cột lương.
 */
export async function exportEmployees(filters?: EmployeeFilters): Promise<DownloadedFile> {
  const { page: _page, limit: _limit, ...rest } = filters ?? {};

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params[key] = String(value);
  }

  try {
    const response = await apiClient.get<Blob>('/reports/employees/export', {
      params,
      responseType: 'blob',
    });

    return {
      blob: response.data,
      filename: filenameFromDisposition(
        response.headers['content-disposition'] as string | undefined,
        EXPORT_FALLBACK_FILENAME,
      ),
    };
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}

/**
 * `GET /reports/attendances/export` → bảng chấm công một tháng, 2 sheet.
 *
 * `month`/`year` BẮT BUỘC, khác với bản xuất nhân viên: bảng chấm công là tài
 * liệu CỦA MỘT THÁNG, không có tháng thì file là toàn bộ lịch sử của công ty.
 */
export async function exportAttendances(filter: {
  month: number;
  year: number;
  departmentId?: number;
  employeeId?: number;
}): Promise<DownloadedFile> {
  const params: Record<string, string> = {
    month: String(filter.month),
    year: String(filter.year),
  };

  if (filter.departmentId !== undefined) {
    params.departmentId = String(filter.departmentId);
  }
  if (filter.employeeId !== undefined) {
    params.employeeId = String(filter.employeeId);
  }

  try {
    const response = await apiClient.get<Blob>('/reports/attendances/export', {
      params,
      responseType: 'blob',
    });

    return {
      blob: response.data,
      filename: filenameFromDisposition(
        response.headers['content-disposition'] as string | undefined,
        'bang-cham-cong.xlsx',
      ),
    };
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}
