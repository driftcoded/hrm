/**
 * Nhận một `Blob` từ API và đưa nó thành file tải về của trình duyệt.
 *
 * Không có API "lưu file" nào trong trình duyệt ngoài việc tạo một thẻ `<a
 * download>` rồi bấm hộ người dùng — nên đoạn DOM thủ công dưới đây là cách
 * làm chuẩn, không phải mẹo vặt.
 */

/** Một file đã tải về, còn nằm trong bộ nhớ. */
export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

/** Tách tên file ra từ header `Content-Disposition`. */
export function filenameFromDisposition(
  disposition: string | undefined,
  fallback: string,
): string {
  if (!disposition) {
    return fallback;
  }

  /*
   * Ưu tiên `filename*=UTF-8''...` (RFC 5987) rồi mới tới `filename="..."`.
   * Backend gửi CẢ HAI: bản ASCII đã bỏ dấu cho trình duyệt cũ và bản UTF-8
   * còn dấu tiếng Việt cho trình duyệt hiện đại. Đọc ngược thứ tự đó thì mọi
   * file tải về đều mất dấu dù backend đã gửi bản đầy đủ.
   */
  const utf8 = /filename\*=UTF-8''([^;\r\n]+)/i.exec(disposition);
  if (utf8?.[1]) {
    try {
      return sanitiseFilename(decodeURIComponent(utf8[1]), fallback);
    } catch {
      // Chuỗi phần trăm hỏng — rơi xuống nhánh ASCII bên dưới.
    }
  }

  const ascii = /filename="?([^";\r\n]+)"?/i.exec(disposition);
  if (ascii?.[1]) {
    return sanitiseFilename(ascii[1], fallback);
  }

  return fallback;
}

/**
 * Header đi từ server nên tên file trong đó là dữ liệu KHÔNG tin cậy. Bỏ mọi
 * thành phần đường dẫn để một `Content-Disposition` độc hại không thể gợi ý
 * ghi ra ngoài thư mục Downloads.
 */
function sanitiseFilename(raw: string, fallback: string): string {
  const name = raw
    .replace(/[\\/]/g, '')
    .replace(/^\.+/, '')
    .trim();
  return name || fallback;
}

/** Lưu `blob` xuống máy dưới tên `filename`. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  // Firefox chỉ kích hoạt `click()` khi thẻ đã nằm trong document.
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  /*
   * Thu hồi ngay lập tức sẽ huỷ URL trước khi trình duyệt kịp đọc xong ở một
   * số bản Safari/Firefox. Lùi sang macro-task kế tiếp là đủ, và không thu hồi
   * thì blob nằm lại trong bộ nhớ cho tới khi đóng tab.
   */
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
