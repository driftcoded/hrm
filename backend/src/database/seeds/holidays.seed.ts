import { DataSource } from 'typeorm';
import { nationalHolidaysFor } from '../../common/utils/vietnam-holidays.util';
import {
  Holiday,
  HolidayType,
} from '../../modules/system/entities/holiday.entity';

/**
 * Lịch nghỉ lễ pháp định, SINH TỪ Điều 112 BLLĐ 2019 chứ không gõ tay.
 *
 * Trước đây file này là 130 dòng ngày tháng chép từ thông báo của Bộ, và thêm
 * một năm nghĩa là ngồi tra lịch âm cho Tết với Giỗ Tổ. Giờ chỉ khai hai thứ mà
 * luật KHÔNG ấn định — Chính phủ chốt lại từng năm:
 *
 *   - `tetDaysBefore`: nghỉ mấy ngày trước mùng 1 (tổng vẫn 5 ngày)
 *   - `nationalDayExtra`: nghỉ thêm 1/9 hay 3/9
 *
 * Hai con số dưới đây lấy từ thông báo chính thức của 2025 và 2026. Năm chưa có
 * thông báo thì bỏ khỏi danh sách và để người dùng bấm "Sinh lịch nghỉ lễ" trên
 * màn hình Cài đặt, rồi sửa lại khi Chính phủ công bố.
 */
const OFFICIAL_YEARS = [
  { year: 2025, tetDaysBefore: 2 },
  { year: 2026, tetDaysBefore: 1 },
] as const;

export async function seedHolidays(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Holiday);

  const rows = OFFICIAL_YEARS.flatMap(({ year, tetDaysBefore }) =>
    nationalHolidaysFor(year, { tetDaysBefore }).map((holiday) => ({
      ...holiday,
      year,
    })),
  );

  let inserted = 0;
  for (const row of rows) {
    const existing = await repo.findOne({
      where: { holidayDate: row.date },
    });
    if (existing) {
      continue;
    }
    await repo.insert({
      name: row.name,
      holidayDate: row.date,
      year: row.year,
      type: HolidayType.NATIONAL,
      isPaid: true,
      note: row.note,
    });
    inserted++;
  }

  const years = OFFICIAL_YEARS.map(({ year }) => year).join('+');
  console.log(
    `  - holidays: OK (${inserted} inserted / ${rows.length} total ${years})`,
  );
}
