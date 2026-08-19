import axios from 'axios';

/**
 * `responseType: 'blob'` áp cho CẢ response lỗi, nên envelope
 * `{ success: false, error: { code } }` về tay ta dưới dạng `Blob` chứ không
 * phải object. Khi đó `getApiError()` không đọc thấy `code` và mọi lỗi — kể cả
 * những mã có hướng dẫn cụ thể như `EXPORT_TOO_MANY_ROWS` — đều tụt xuống câu
 * báo lỗi chung chung.
 *
 * Đọc blob ra JSON rồi gắn ngược vào `error.response.data` để phần còn lại của
 * ứng dụng xử lý lỗi này y hệt mọi lỗi khác. Blob không phải JSON (HTML của
 * proxy, response rỗng...) thì trả nguyên lỗi cũ — vẫn là nhánh "không rõ mã".
 *
 * Ở file riêng vì mọi endpoint tải file đều cần nó; để trong một service thì
 * service thứ hai sẽ chép lại, và bản chép sẽ lệch.
 */
export async function withJsonErrorBody(error: unknown): Promise<unknown> {
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
