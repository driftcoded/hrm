/**
 * Quy tắc phép năm (business-rules.md §8, Điều 113 BLLĐ 2019).
 *
 * Hàm THUẦN: không chạm DB, không đọc đồng hồ. Ngày lễ được TRUYỀN VÀO chứ
 * không tự tra — danh mục ngày lễ nằm ở bảng `holidays` và đổi theo từng năm,
 * kéo nó vào đây sẽ biến một hàm kiểm chứng được thành thứ phải dựng database
 * mới test nổi.
 */

/** Số ngày phép cơ bản của một năm làm việc (Điều 113 khoản 1). */
export const BASE_ANNUAL_LEAVE_DAYS = 12;

/** Cứ đủ ngần này năm thâm niên thì được thêm 1 ngày phép (Điều 113 khoản 2). */
export const SENIORITY_YEARS_PER_EXTRA_DAY = 5;

/** Nửa ngày phép — nghỉ buổi sáng hoặc buổi chiều. */
export const HALF_DAY = 0.5;

export enum LeaveHalf {
  FULL = 'full',
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
}

/**
 * Số ngày phép năm theo thâm niên: 12 + ⌊thâm niên ÷ 5⌋.
 *
 * Thâm niên tính bằng SỐ NĂM TRÒN đã làm tại công ty tính đến ngày mốc — luật
 * viết "cứ đủ 05 năm làm việc", nên 4 năm 11 tháng vẫn chưa được cộng.
 */
export function annualLeaveDays(seniorityYears: number): number {
  const completedYears = Math.max(0, Math.floor(seniorityYears));

  return (
    BASE_ANNUAL_LEAVE_DAYS +
    Math.floor(completedYears / SENIORITY_YEARS_PER_EXTRA_DAY)
  );
}

/**
 * Số năm thâm niên TRÒN tính đến `asOf`.
 *
 * Đếm theo mốc kỷ niệm ngày vào làm, không phải chia số ngày cho 365: vào làm
 * 01/03/2020, đến 28/02/2025 vẫn là 4 năm chứ chưa phải 5.
 */
export function seniorityYears(hireDate: string, asOf: string): number {
  const [hireYear, hireMonth, hireDay] = hireDate.split('-').map(Number);
  const [asOfYear, asOfMonth, asOfDay] = asOf.split('-').map(Number);

  let years = asOfYear - hireYear;

  if (asOfMonth < hireMonth || (asOfMonth === hireMonth && asOfDay < hireDay)) {
    years -= 1;
  }

  return Math.max(0, years);
}

/**
 * Phép của NĂM ĐẦU TIÊN, tính theo tỉ lệ số tháng đã làm (business-rules §8.3).
 *
 * > Phép = Số ngày phép năm × (Số tháng đã làm ÷ 12)
 *
 * Làm tròn xuống 0,5 ngày: hệ thống chỉ ghi nhận được nửa ngày, nên 7,3 ngày
 * là một con số không tiêu được. Làm tròn XUỐNG chứ không lên — cấp dư phép
 * rồi đòi lại là việc không ai làm được.
 *
 * Vào làm sau ngày 15 thì tháng đó không được tính: nửa tháng đầu tiên chưa đủ
 * để hưởng trọn một tháng phép, và đây là cách tính phổ biến ở doanh nghiệp VN.
 */
export function proratedFirstYearDays(
  hireDate: string,
  year: number,
  fullYearDays: number = BASE_ANNUAL_LEAVE_DAYS,
): number {
  const [hireYear, hireMonth, hireDay] = hireDate.split('-').map(Number);

  // Vào làm từ năm trước ⇒ năm này đã là một năm trọn vẹn.
  if (hireYear < year) {
    return fullYearDays;
  }

  // Vào làm sau năm đang xét ⇒ chưa có ngày phép nào.
  if (hireYear > year) {
    return 0;
  }

  const firstCountedMonth = hireDay <= 15 ? hireMonth : hireMonth + 1;
  const monthsWorked = Math.max(0, 12 - firstCountedMonth + 1);

  return floorToHalf((fullYearDays * monthsWorked) / 12);
}

/** Làm tròn xuống bội số 0,5. */
export function floorToHalf(value: number): number {
  return Math.floor(value * 2) / 2;
}

export interface LeaveDaysInput {
  /** `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  /** Nghỉ nửa ngày ở đầu/cuối kỳ. */
  startHalf?: LeaveHalf;
  endHalf?: LeaveHalf;
  /** Ngày lễ trong kỳ, `YYYY-MM-DD` — tra từ bảng `holidays`. */
  holidays?: ReadonlySet<string>;
}

/**
 * Số ngày phép THỰC TẾ bị trừ của một kỳ nghỉ (business-rules §8.2).
 *
 * CHỈ ĐẾM NGÀY LÀM VIỆC. Thứ Bảy, Chủ nhật và ngày lễ nằm trong kỳ nghỉ không
 * bị trừ phép — nghỉ từ thứ Sáu đến thứ Hai là 2 ngày phép, không phải 4. Tính
 * cả cuối tuần là lấy mất của nhân viên những ngày họ vốn được nghỉ.
 */
export function countLeaveDays(input: LeaveDaysInput): number {
  const workingDays = workingDaysBetween(
    input.startDate,
    input.endDate,
    input.holidays ?? new Set<string>(),
  );

  if (workingDays.length === 0) {
    return 0;
  }

  let total = workingDays.length;

  /*
   * Nửa ngày chỉ trừ khi ngày đó THỰC SỰ là ngày làm việc. Xin nghỉ nửa ngày
   * thứ Bảy thì không có gì để trừ, và trừ 0,5 sẽ lấy mất nửa ngày phép cho
   * một ngày vốn đã được nghỉ.
   */
  if (isHalf(input.startHalf) && workingDays.includes(input.startDate)) {
    total -= HALF_DAY;
  }

  /*
   * Kỳ nghỉ chỉ một ngày mà cả hai đầu đều là nửa ngày thì đó vẫn là MỘT nửa
   * ngày, không phải hai — trừ hai lần sẽ ra 0.
   */
  const isSameDay = input.startDate === input.endDate;

  if (
    !isSameDay &&
    isHalf(input.endHalf) &&
    workingDays.includes(input.endDate)
  ) {
    total -= HALF_DAY;
  }

  return Math.max(0, total);
}

function isHalf(half?: LeaveHalf): boolean {
  return half === LeaveHalf.MORNING || half === LeaveHalf.AFTERNOON;
}

/** Ngày làm việc (T2–T6, không phải ngày lễ) trong khoảng, kể cả hai đầu. */
export function workingDaysBetween(
  from: string,
  to: string,
  holidays: ReadonlySet<string>,
): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getUTCDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(date)) {
      days.push(date);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}
