import { IsNull } from 'typeorm';
import { DataSource } from 'typeorm';
import { STATUTORY_HOLIDAY_RULES } from '../../common/constants/holiday.constant';
import {
  Holiday,
  HolidayCalendar,
  HolidayType,
} from '../../modules/system/entities/holiday.entity';

export async function seedHolidays(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Holiday);
  let inserted = 0;

  for (const rule of STATUTORY_HOLIDAY_RULES) {
    const existing = await repo.findOne({
      where: { code: rule.code, year: IsNull() },
    });

    if (existing) {
      continue;
    }

    await repo.insert({
      code: rule.code,
      name: rule.name,
      type: rule.type as HolidayType,
      calendar: rule.calendar as HolidayCalendar,
      month: rule.month,
      day: rule.day,
      offsetDays: rule.offsetDays,
      durationDays: rule.durationDays,
      year: null,
      isPaid: rule.isPaid,
      isActive: true,
      sortOrder: rule.sortOrder,
      note: rule.note,
    });

    inserted++;
  }

  console.log(
    `  - holidays: OK (${inserted} inserted / ${STATUTORY_HOLIDAY_RULES.length} total)`,
  );
}
