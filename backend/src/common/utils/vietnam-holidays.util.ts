import {
  dateFromJulianDay,
  julianDayFromDate,
  lunarDateInSolarYear,
  solarToLunar,
  toDateString,
} from './lunar-calendar.util';

/**
 * Suy ra lịch nghỉ của một năm từ các ĐỊNH NGHĨA kỳ nghỉ.
 *
 * Định nghĩa là quy tắc ("Tết: âm 01/01, sớm 1 ngày, dài 5 ngày"), ngày cụ thể
 * là kết quả tính ra. Nhờ vậy khai một lần dùng cho mọi năm, kể cả những kỳ
 * nghỉ theo âm lịch mà năm nào cũng rơi vào ngày dương khác nhau.
 */

export const DEFAULT_TET_DAYS_BEFORE = 1;
export const TET_TOTAL_DAYS = 5;
export const DEFAULT_NATIONAL_DAY_EXTRA = 'before' as const;
export type NationalDayExtra = 'before' | 'after';

/** Ngày nghỉ hằng tuần của công ty: thứ Bảy và Chủ nhật. */
const WEEKLY_REST_DAYS = new Set([0, 6]);

export type HolidayCalendarKind = 'solar' | 'lunar';

/** Quy tắc của một kỳ nghỉ — khớp các cột của bảng `holidays`. */
export interface HolidayRule {
  code: string;
  name: string;
  type: string;
  calendar: HolidayCalendarKind;
  month: number;
  day: number;
  offsetDays: number;
  durationDays: number;
  /** NULL = mọi năm; có giá trị = chỉ năm đó và đè lên quy tắc mọi năm. */
  year: number | null;
  isPaid: boolean;
  isActive: boolean;
  sortOrder: number;
  note: string | null;
}

export interface ResolvedHoliday {
  /** `YYYY-MM-DD`. */
  date: string;
  code: string;
  name: string;
  type: string;
  isPaid: boolean;
  /** Ngày thứ mấy trong kỳ nghỉ, bắt đầu từ 1. */
  dayIndex: number;
  /** Tổng số ngày của kỳ nghỉ. */
  dayCount: number;
  /** Ngày nghỉ bù do ngày lễ rơi vào ngày nghỉ hằng tuần. */
  isCompensatory: boolean;
  note: string | null;
}

export interface ResolveOptions {
  /** Nghỉ bù khi ngày lễ rơi vào thứ Bảy/Chủ nhật (Điều 111 khoản 3). */
  compensateWeekends?: boolean;
}

/** Cộng/trừ số ngày vào một chuỗi `YYYY-MM-DD`. */
export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = dateFromJulianDay(julianDayFromDate(day, month, year) + days);

  return toDateString(shifted.day, shifted.month, shifted.year);
}

/** Thứ trong tuần: 0 = Chủ nhật … 6 = thứ Bảy. */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function isWeekend(date: string): boolean {
  return WEEKLY_REST_DAYS.has(dayOfWeek(date));
}

const WEEKDAY_NAMES = [
  'Chủ nhật',
  'thứ Hai',
  'thứ Ba',
  'thứ Tư',
  'thứ Năm',
  'thứ Sáu',
  'thứ Bảy',
];

function formatDayVi(date: string): string {
  const [year, month, day] = date.split('-');

  return `${WEEKDAY_NAMES[dayOfWeek(date)]} ${day}/${month}/${year}`;
}

/**
 * Quy tắc có hiệu lực cho một năm.
 *
 * Cùng một `code` mà có cả dòng mọi năm lẫn dòng của đúng năm đó thì dòng của
 * năm thắng — chỗ để ghi lại những năm Chính phủ chốt khác lệ thường.
 */
export function rulesForYear(
  rules: HolidayRule[],
  year: number,
): HolidayRule[] {
  const chosen = new Map<string, HolidayRule>();

  for (const rule of rules) {
    if (!rule.isActive || (rule.year !== null && rule.year !== year)) {
      continue;
    }

    const current = chosen.get(rule.code);

    if (
      current === undefined ||
      (current.year === null && rule.year !== null)
    ) {
      chosen.set(rule.code, rule);
    }
  }

  return [...chosen.values()].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
}

/** Ngày neo của một quy tắc trong một năm dương, hoặc `null` nếu năm đó không có. */
function anchorDate(rule: HolidayRule, year: number): string | null {
  if (rule.calendar === 'solar') {
    return toDateString(rule.day, rule.month, year);
  }

  return lunarDateInSolarYear(rule.day, rule.month, year);
}

/**
 * Lịch nghỉ của `year`, đã sắp theo ngày.
 *
 * Ngày lễ rơi vào thứ Bảy/Chủ nhật thì thêm ngày nghỉ bù vào ngày làm việc kế
 * tiếp còn trống, giữ đủ số ngày nghỉ thực tế mà luật cho.
 */
export function resolveHolidays(
  rules: HolidayRule[],
  year: number,
  options: ResolveOptions = {},
): ResolvedHoliday[] {
  const compensateWeekends = options.compensateWeekends ?? true;
  const resolved: ResolvedHoliday[] = [];

  for (const rule of rulesForYear(rules, year)) {
    const anchor = anchorDate(rule, year);

    if (anchor === null) {
      continue;
    }

    const start = shiftDate(anchor, rule.offsetDays);

    for (let index = 0; index < rule.durationDays; index += 1) {
      const date = shiftDate(start, index);

      // Kỳ nghỉ bắc qua giao thừa dương lịch thì phần lọt sang năm khác
      // thuộc về lịch của năm đó, không phải năm đang tính.
      if (!date.startsWith(String(year))) {
        continue;
      }

      resolved.push({
        date,
        code: rule.code,
        name: rule.name,
        type: rule.type,
        isPaid: rule.isPaid,
        dayIndex: index + 1,
        dayCount: rule.durationDays,
        isCompensatory: false,
        note: describeDay(rule, date, index),
      });
    }
  }

  const all = compensateWeekends
    ? [...resolved, ...compensationFor(resolved)]
    : resolved;

  return all.sort((left, right) => left.date.localeCompare(right.date));
}

/** Ghi chú của một ngày: vị trí trong kỳ nghỉ, kèm ngày âm nếu kỳ nghỉ theo âm lịch. */
function describeDay(
  rule: HolidayRule,
  date: string,
  index: number,
): string | null {
  if (rule.calendar === 'lunar') {
    const lunar = solarToLunar(
      Number(date.slice(8, 10)),
      Number(date.slice(5, 7)),
      Number(date.slice(0, 4)),
    );
    const lunarLabel = `${lunar.day}/${lunar.month} âm lịch`;

    return rule.note ? `${lunarLabel} — ${rule.note}` : lunarLabel;
  }

  if (rule.durationDays > 1) {
    const position = `Ngày ${index + 1}/${rule.durationDays} của kỳ nghỉ`;

    return rule.note ? `${position} — ${rule.note}` : position;
  }

  return rule.note;
}

/**
 * Ngày nghỉ bù cho những ngày lễ rơi vào ngày nghỉ hằng tuần.
 *
 * Ngày bù là ngày làm việc gần nhất phía sau chưa bị chiếm — hai ngày lễ cùng
 * rơi vào một cuối tuần thì bù thành hai ngày liên tiếp, không chồng lên nhau.
 */
function compensationFor(holidays: ResolvedHoliday[]): ResolvedHoliday[] {
  const taken = new Set(holidays.map((holiday) => holiday.date));
  const extra: ResolvedHoliday[] = [];

  for (const holiday of [...holidays].sort((left, right) =>
    left.date.localeCompare(right.date),
  )) {
    if (!isWeekend(holiday.date)) {
      continue;
    }

    let candidate = shiftDate(holiday.date, 1);

    while (isWeekend(candidate) || taken.has(candidate)) {
      candidate = shiftDate(candidate, 1);
    }

    taken.add(candidate);
    extra.push({
      ...holiday,
      date: candidate,
      name: `${holiday.name} (nghỉ bù)`,
      dayIndex: 1,
      dayCount: 1,
      isCompensatory: true,
      note: `${holiday.name} nhằm ${formatDayVi(holiday.date)} — nghỉ bù theo Điều 111 khoản 3`,
    });
  }

  return extra;
}
