import { DataSource } from 'typeorm';
import {
  Holiday,
  HolidayType,
} from '../../modules/system/entities/holiday.entity';

interface HolidaySeedRow {
  name: string;
  holidayDate: string;
  year: number;
  note?: string;
}

/**
 * Lịch nghỉ lễ VN 2025 (Nghị định 18/2024/NĐ-CP + Thông báo Bộ LĐTBXH) và
 * 2026 (dự kiến theo Thông báo Bộ Nội vụ, dành cho cán bộ/công chức/viên chức
 * — áp dụng chung cho lịch nghỉ công ty).
 */
const HOLIDAYS_2025: HolidaySeedRow[] = [
  { name: 'Tết Dương lịch', holidayDate: '2025-01-01', year: 2025 },
  {
    name: 'Nghỉ Tết Nguyên Đán (Ất Tỵ)',
    holidayDate: '2025-01-27',
    year: 2025,
    note: '27 tháng Chạp Giáp Thìn',
  },
  {
    name: 'Nghỉ Tết Nguyên Đán (Ất Tỵ)',
    holidayDate: '2025-01-28',
    year: 2025,
    note: '28 tháng Chạp – Giao thừa',
  },
  {
    name: 'Nghỉ Tết Nguyên Đán (Ất Tỵ)',
    holidayDate: '2025-01-29',
    year: 2025,
    note: 'Mùng 1 Tết Ất Tỵ',
  },
  {
    name: 'Nghỉ Tết Nguyên Đán (Ất Tỵ)',
    holidayDate: '2025-01-30',
    year: 2025,
    note: 'Mùng 2 Tết Ất Tỵ',
  },
  {
    name: 'Nghỉ Tết Nguyên Đán (Ất Tỵ)',
    holidayDate: '2025-01-31',
    year: 2025,
    note: 'Mùng 3 Tết Ất Tỵ',
  },
  {
    name: 'Giỗ Tổ Hùng Vương',
    holidayDate: '2025-04-07',
    year: 2025,
    note: '10/3 âm lịch',
  },
  {
    name: 'Ngày Giải phóng miền Nam',
    holidayDate: '2025-04-30',
    year: 2025,
  },
  { name: 'Ngày Quốc tế Lao động', holidayDate: '2025-05-01', year: 2025 },
  {
    name: 'Ngày Quốc khánh',
    holidayDate: '2025-09-01',
    year: 2025,
    note: 'Nghỉ liền kề trước 2/9',
  },
  { name: 'Ngày Quốc khánh', holidayDate: '2025-09-02', year: 2025 },
];

const HOLIDAYS_2026: HolidaySeedRow[] = [
  { name: 'Tết Dương lịch', holidayDate: '2026-01-01', year: 2026 },
  {
    name: 'Nghỉ Tết Nguyên Đán (Bính Ngọ)',
    holidayDate: '2026-02-16',
    year: 2026,
    note: '29 tháng Chạp Ất Tỵ',
  },
  {
    name: 'Nghỉ Tết Nguyên Đán (Bính Ngọ)',
    holidayDate: '2026-02-17',
    year: 2026,
    note: 'Mùng 1 Tết Bính Ngọ',
  },
  {
    name: 'Nghỉ Tết Nguyên Đán (Bính Ngọ)',
    holidayDate: '2026-02-18',
    year: 2026,
    note: 'Mùng 2 Tết Bính Ngọ',
  },
  {
    name: 'Nghỉ Tết Nguyên Đán (Bính Ngọ)',
    holidayDate: '2026-02-19',
    year: 2026,
    note: 'Mùng 3 Tết Bính Ngọ',
  },
  {
    name: 'Nghỉ Tết Nguyên Đán (Bính Ngọ)',
    holidayDate: '2026-02-20',
    year: 2026,
    note: 'Mùng 4 Tết Bính Ngọ',
  },
  {
    name: 'Giỗ Tổ Hùng Vương (nghỉ bù)',
    holidayDate: '2026-04-27',
    year: 2026,
    note: '10/3 âm lịch nhằm Chủ Nhật 26/4/2026, nghỉ bù thứ Hai',
  },
  {
    name: 'Ngày Giải phóng miền Nam',
    holidayDate: '2026-04-30',
    year: 2026,
  },
  { name: 'Ngày Quốc tế Lao động', holidayDate: '2026-05-01', year: 2026 },
  {
    name: 'Ngày Quốc khánh',
    holidayDate: '2026-09-01',
    year: 2026,
    note: 'Nghỉ liền kề trước 2/9',
  },
  { name: 'Ngày Quốc khánh', holidayDate: '2026-09-02', year: 2026 },
];

export async function seedHolidays(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Holiday);
  const rows = [...HOLIDAYS_2025, ...HOLIDAYS_2026];

  let inserted = 0;
  for (const row of rows) {
    const existing = await repo.findOne({
      where: { holidayDate: row.holidayDate },
    });
    if (existing) {
      continue;
    }
    await repo.insert({
      name: row.name,
      holidayDate: row.holidayDate,
      year: row.year,
      type: HolidayType.NATIONAL,
      isPaid: true,
      note: row.note ?? null,
    });
    inserted++;
  }

  console.log(
    `  - holidays: OK (${inserted} inserted / ${rows.length} total 2025+2026)`,
  );
}
