import { STATUTORY_HOLIDAY_RULES } from '@/common/constants/holiday.constant';
import { lunarToSolar, solarToLunar } from './lunar-calendar.util';
import {
  resolveHolidays,
  rulesForYear,
  type HolidayRule,
} from './vietnam-holidays.util';

/** Sáu quy tắc pháp định, dạng đầy đủ như khi đọc từ bảng `holidays`. */
const RULES: HolidayRule[] = STATUTORY_HOLIDAY_RULES.map((rule) => ({
  ...rule,
  year: null,
  isActive: true,
}));

/** Một quy tắc riêng cho một năm, đè lên quy tắc mọi năm cùng `code`. */
function override(code: string, year: number, patch: Partial<HolidayRule>) {
  const base = RULES.find((rule) => rule.code === code);

  if (!base) {
    throw new Error(`khong co quy tac ${code}`);
  }

  return { ...base, year, ...patch };
}

describe('lịch âm', () => {
  it('đổi đúng mùng 1 Tết vài năm liên tiếp', () => {
    expect(lunarToSolar(1, 1, 2024)).toMatchObject({ day: 10, month: 2, year: 2024 });
    expect(lunarToSolar(1, 1, 2025)).toMatchObject({ day: 29, month: 1, year: 2025 });
    expect(lunarToSolar(1, 1, 2026)).toMatchObject({ day: 17, month: 2, year: 2026 });
    expect(lunarToSolar(1, 1, 2027)).toMatchObject({ day: 6, month: 2, year: 2027 });
  });

  it('đổi xuôi rồi ngược thì về đúng ngày cũ', () => {
    for (const [day, month, year] of [
      [1, 1, 2025],
      [29, 1, 2025],
      [17, 2, 2026],
      [30, 4, 2026],
      [31, 12, 2027],
    ]) {
      const lunar = solarToLunar(day, month, year);

      expect(
        lunarToSolar(lunar.day, lunar.month, lunar.year, lunar.isLeapMonth),
      ).toMatchObject({ day, month, year });
    }
  });
});

describe('suy ra lịch nghỉ từ định nghĩa', () => {
  it('khớp lịch nghỉ chính thức năm 2025', () => {
    // 2025 Chính phủ chốt nghỉ sớm 2 ngày trước mùng 1 — khai bằng một dòng
    // riêng cho năm 2025, quy tắc chung giữ nguyên.
    const rules = [...RULES, override('TET', 2025, { offsetDays: -2 })];

    expect(resolveHolidays(rules, 2025).map((day) => day.date)).toEqual([
      '2025-01-01',
      '2025-01-27',
      '2025-01-28',
      '2025-01-29',
      '2025-01-30',
      '2025-01-31',
      '2025-04-07',
      '2025-04-30',
      '2025-05-01',
      '2025-09-01',
      '2025-09-02',
    ]);
  });

  it('khớp lịch nghỉ chính thức năm 2026, gồm cả ngày nghỉ bù Giỗ Tổ', () => {
    const holidays = resolveHolidays(RULES, 2026);

    expect(holidays.map((day) => day.date)).toEqual([
      '2026-01-01',
      '2026-02-16',
      '2026-02-17',
      '2026-02-18',
      '2026-02-19',
      '2026-02-20',
      '2026-04-26',
      '2026-04-27',
      '2026-04-30',
      '2026-05-01',
      '2026-09-01',
      '2026-09-02',
    ]);

    const compensation = holidays.find((day) => day.isCompensatory);
    expect(compensation?.date).toBe('2026-04-27');
    expect(compensation?.name).toContain('nghỉ bù');
  });

  it('ghi rõ ngày âm lịch cho kỳ nghỉ theo âm lịch', () => {
    const tet = resolveHolidays(RULES, 2026).find(
      (day) => day.date === '2026-02-17',
    );

    expect(tet?.note).toContain('1/1 âm lịch');
    expect(tet?.dayIndex).toBe(2);
    expect(tet?.dayCount).toBe(5);
  });

  it('quy tắc của một năm đè lên quy tắc mọi năm', () => {
    const rules = [...RULES, override('NATIONAL_DAY', 2027, { offsetDays: 0 })];
    const dates = resolveHolidays(rules, 2027).map((day) => day.date);

    expect(dates).toContain('2027-09-02');
    expect(dates).toContain('2027-09-03');
    expect(dates).not.toContain('2027-09-01');

    // Năm khác vẫn theo lệ thường.
    expect(resolveHolidays(rules, 2028).map((day) => day.date)).toContain(
      '2028-09-01',
    );
  });

  it('bỏ qua quy tắc đã tắt', () => {
    const rules = RULES.map((rule) =>
      rule.code === 'LABOUR_DAY' ? { ...rule, isActive: false } : rule,
    );

    expect(rulesForYear(rules, 2027)).toHaveLength(5);
    expect(resolveHolidays(rules, 2027).map((day) => day.date)).not.toContain(
      '2027-05-01',
    );
  });

  it('không sinh ngày nghỉ bù khi tắt tuỳ chọn đó', () => {
    const holidays = resolveHolidays(RULES, 2026, {
      compensateWeekends: false,
    });

    expect(holidays.filter((day) => day.isCompensatory)).toEqual([]);
    expect(holidays).toHaveLength(11);
  });

  it('không dồn hai ngày bù vào cùng một ngày, suốt 30 năm', () => {
    for (let year = 2026; year < 2056; year += 1) {
      const dates = resolveHolidays(RULES, year).map((day) => day.date);

      expect(new Set(dates).size).toBe(dates.length);
      expect(dates.length).toBeGreaterThanOrEqual(11);
      expect(dates.every((date) => date.startsWith(String(year)))).toBe(true);
    }
  });

  it('kỳ nghỉ lọt sang năm sau thì không tính vào năm đang xem', () => {
    // Tết 2033 rơi 31/01, nghỉ sớm 1 ngày ⇒ 30/01; không có ngày nào của 2032.
    const rules = [...RULES, override('TET', 2032, { offsetDays: -10 })];
    const dates = resolveHolidays(rules, 2032).map((day) => day.date);

    expect(dates.every((date) => date.startsWith('2032'))).toBe(true);
  });
});
