import { Workbook } from 'exceljs';
import {
  addStyledSheet,
  DATE_NUMBER_FORMAT,
} from '@/modules/reports/utils/excel.util';

/**
 * File mẫu cho `POST /attendances/bulk-import`.
 *
 * VÌ SAO CÓ: không có file mẫu thì HR phải đoán tên cột, và cách hỏng phổ biến
 * nhất của mọi tính năng import là file đúng dữ liệu nhưng sai tiêu đề. Rẻ hơn
 * nhiều so với việc đọc log để hiểu vì sao một file bị từ chối.
 *
 * Có sẵn 3 dòng ví dụ để thấy ĐỊNH DẠNG mong đợi:
 *   1. một ngày đủ giờ vào–ra và giờ nghỉ đúng khung chuẩn,
 *   2. một ngày chỉ có giờ vào (quên chấm ra) — vẫn hợp lệ, và hai cột nghỉ để
 *      trống thì hệ thống trừ theo khung nghỉ chuẩn,
 *   3. một ngày có giờ nghỉ lệch khung chuẩn.
 */
export function buildImportTemplate(): Workbook {
  const workbook = new Workbook();
  workbook.creator = 'HRM';

  addStyledSheet(
    workbook,
    'Chấm công',
    [
      { header: 'Mã NV', width: 14 },
      { header: 'Ngày', width: 14, numberFormat: DATE_NUMBER_FORMAT },
      { header: 'Giờ vào', width: 12 },
      { header: 'Giờ ra', width: 12 },
      { header: 'Giờ nghỉ từ', width: 14 },
      { header: 'Giờ nghỉ đến', width: 14 },
      { header: 'Ghi chú', width: 32 },
    ],
    [
      [
        'NV0001',
        new Date(Date.UTC(2026, 4, 4)),
        '08:00',
        '17:30',
        '12:00',
        '13:00',
        '',
      ],
      [
        'NV0002',
        new Date(Date.UTC(2026, 4, 4)),
        '08:10',
        '',
        '',
        '',
        'Quên chấm ra',
      ],
      // Nghỉ 0 phút = làm xuyên trưa. Bỏ TRỐNG hai cột nghỉ thì hệ thống dùng
      // khung nghỉ chuẩn 12:00–13:00; điền hai giờ BẰNG NHAU mới là "không nghỉ".
      [
        'NV0003',
        new Date(Date.UTC(2026, 4, 4)),
        '08:00',
        '17:00',
        '12:00',
        '12:00',
        'Làm xuyên trưa',
      ],
    ],
  );

  return workbook;
}
