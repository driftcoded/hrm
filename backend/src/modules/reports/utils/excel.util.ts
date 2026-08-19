import { Workbook, Worksheet } from 'exceljs';

/**
 * Helper dựng worksheet cho các bản xuất Excel của module reports.
 *
 * Nguyên tắc (api-spec.md §19 + yêu cầu nghiệp vụ):
 *  - Tiền là SỐ THỰC + `numFmt` VNĐ, KHÔNG phải chuỗi đã format sẵn. Kế toán
 *    còn phải SUM/lọc trên file này; `"15.000.000 ₫"` là text nên mọi công
 *    thức đều hỏng.
 *  - Ngày là `Date` thật + `numFmt` `dd/mm/yyyy`, không phải chuỗi.
 *  - Hàng tiêu đề in đậm + đóng băng (freeze pane) để cuộn 10.000 dòng vẫn
 *    biết mình đang đọc cột nào.
 */

/** MIME type của .xlsx (api-spec.md §19). */
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Định dạng tiền VNĐ: phân cách nghìn, không phần thập phân. */
export const VND_NUMBER_FORMAT = '#,##0';

/** Ngày hiển thị theo chuẩn Việt Nam. */
export const DATE_NUMBER_FORMAT = 'dd/mm/yyyy';

/** Nền xám nhạt của hàng tiêu đề. */
const HEADER_FILL_ARGB = 'FFE8EEF7';

export interface ExcelColumnSpec {
  header: string;
  width: number;
  /** `numFmt` của Excel; bỏ trống = cột chữ. */
  numberFormat?: string;
}

/** Giá trị hợp lệ của một ô trong các bản xuất này. `null` = ô trống. */
export type ExcelCellValue = string | number | Date | null;

/**
 * Chuyển `YYYY-MM-DD` (hoặc `Date` do driver trả về) thành `Date` ở mốc nửa
 * đêm **UTC**.
 *
 * Bắt buộc phải là UTC: ExcelJS quy đổi `Date` sang serial number bằng
 * `getTime()` chia cho số mili-giây một ngày, tức là theo UTC. Nếu dựng
 * `new Date('2026-08-19')` theo giờ địa phương UTC+7 thì serial rơi vào
 * 18/08 và cả file lệch một ngày.
 */
export function toExcelDate(
  value: string | Date | null | undefined,
): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
    );
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

/**
 * Tạo một sheet đã style sẵn: tiêu đề in đậm + đóng băng + autofilter + độ
 * rộng cột. Sheet KHÔNG có dòng nào vẫn là sheet hợp lệ — bản xuất rỗng phải
 * ra file mở được, không phải lỗi 500.
 */
export function addStyledSheet(
  workbook: Workbook,
  name: string,
  columns: ExcelColumnSpec[],
  rows: ExcelCellValue[][],
): Worksheet {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = columns.map((column) => ({
    header: column.header,
    width: column.width,
    style: column.numberFormat ? { numFmt: column.numberFormat } : undefined,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: HEADER_FILL_ARGB },
  };
  headerRow.height = 24;
  headerRow.commit();

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  for (const row of rows) {
    sheet.addRow(row);
  }

  return sheet;
}

/**
 * Header `Content-Disposition` cho file tải về.
 *
 * Hai tên file theo RFC 6266/5987:
 *  - `filename=` chỉ ASCII (bỏ dấu tiếng Việt) — client cũ chỉ đọc được cái này
 *    và một tên có dấu chưa mã hoá sẽ thành ký tự rác trên đĩa người dùng.
 *  - `filename*=UTF-8''…` giữ nguyên tên tiếng Việt cho trình duyệt hiện đại.
 */
export function buildContentDisposition(
  asciiFilename: string,
  utf8Filename: string,
): string {
  return [
    'attachment',
    `filename="${asciiFilename.replace(/["\\]/g, '')}"`,
    `filename*=UTF-8''${encodeRfc5987(utf8Filename)}`,
  ].join('; ');
}

/**
 * `encodeURIComponent` để nguyên `!'()*`, vốn KHÔNG thuộc `attr-char` của
 * RFC 5987 — phải mã hoá nốt, nếu không một số client sẽ cắt tên file.
 */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*!]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Bỏ dấu tiếng Việt + ký tự không an toàn để dựng phần `filename=` ASCII.
 * `đ/Đ` không phải là chữ có dấu tổ hợp nên `normalize('NFD')` không tách ra
 * được, phải thay thủ công.
 */
export function toAsciiFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
