import axios from 'axios';
import { apiClient } from '@/lib/axios';
import type { EmployeeFilters } from '@/types/employee.types';
import { filenameFromDisposition } from '@/utils/download';

/**
 * Mọi call tới `/reports` — hiện chỉ có bản xuất Excel danh sách nhân viên,
 * sẽ có thêm báo cáo chấm công/lương ở Giai đoạn 4–6.
 *
 * Tách khỏi `employee.service.ts` vì file đó tự khai là nơi DUY NHẤT gọi
 * `/employees`, `/contracts`, `/roles`, `/users`; `/reports` là module khác
 * ở backend và có phân quyền riêng, nên trộn vào đó là làm sai chính câu
 * ghi chú đầu file kia.
 */

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

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
 * `responseType: 'blob'` áp cho CẢ response lỗi, nên body `{ success: false,
 * error: { code } }` về tay ta dưới dạng `Blob` chứ không phải object. Khi đó
 * `getApiError()` không đọc thấy `code` và mọi lỗi — kể cả
 * `EXPORT_TOO_MANY_ROWS` vốn có hướng dẫn cụ thể — đều tụt xuống câu báo lỗi
 * chung chung.
 *
 * Đọc blob ra JSON rồi gắn ngược vào `error.response.data` để phần còn lại của
 * ứng dụng xử lý lỗi này y hệt mọi lỗi khác. Blob không phải JSON (HTML của
 * proxy, response rỗng...) thì trả nguyên lỗi cũ — vẫn là nhánh "không rõ mã".
 */
async function withJsonErrorBody(error: unknown): Promise<unknown> {
  if (!axios.isAxiosError(error) || !(error.response?.data instanceof Blob)) {
    return error;
  }

  try {
    error.response.data = JSON.parse(await error.response.data.text()) as unknown;
  } catch {
    // Không phải JSON — để nguyên, caller sẽ hiển thị lỗi chung.
  }

  return error;
}
