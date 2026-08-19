/**
 * Che dữ liệu định danh nhạy cảm trước khi ghi vào file Excel.
 *
 * Vì sao che theo MẶC ĐỊNH (CLAUDE.md §Bảo mật + PLAN Giai đoạn 8):
 * CCCD đã bị che ở màn hình danh sách và nằm trong danh sách "mã hoá at rest";
 * số tài khoản ngân hàng là dữ liệu thanh toán. Một file `.xlsx` thì được gửi
 * email, upload Drive, forward tiếp — nó rời khỏi vòng kiểm soát của app ngay
 * khi tải về. Nên bản xuất mặc định KHÔNG mang giá trị gốc; muốn giá trị gốc
 * phải xin tường minh bằng `?includeSensitive=true` và phải là admin/hr_manager
 * (xem EmployeeExportService.resolveSensitiveAccess).
 */

/** Số ký tự cuối được giữ lại để người đọc còn đối chiếu được hồ sơ. */
export const VISIBLE_SUFFIX_LENGTH = 4;

/**
 * `001098765432` → `********9432`.
 *
 * Giữ đúng độ dài chuỗi gốc để cột trong Excel không bị hiểu nhầm là dữ liệu
 * thiếu. Chuỗi ngắn hơn `VISIBLE_SUFFIX_LENGTH` bị che TOÀN BỘ — che 4 ký tự
 * cuối của một chuỗi 4 ký tự thì chẳng che gì cả.
 */
export function maskIdentifier(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length <= VISIBLE_SUFFIX_LENGTH) {
    return '*'.repeat(trimmed.length);
  }

  const hidden = trimmed.length - VISIBLE_SUFFIX_LENGTH;

  return `${'*'.repeat(hidden)}${trimmed.slice(hidden)}`;
}

/** Alias có nghĩa nghiệp vụ – dùng cho cột "Số CCCD". */
export const maskCccd = maskIdentifier;

/** Alias có nghĩa nghiệp vụ – dùng cho cột "Số tài khoản". */
export const maskBankAccount = maskIdentifier;
