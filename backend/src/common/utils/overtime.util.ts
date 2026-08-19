import {
  NIGHT_SHIFT_END_TIME,
  NIGHT_SHIFT_START_TIME,
  OVERTIME_RATES,
} from '@/common/constants/attendance.constant';
import { minutesToHours, parseTimeToMinutes } from './work-hours.util';

/**
 * Tính giờ và hệ số cho một ca làm thêm (business-rules.md §7, Điều 98 BLLĐ 2019).
 *
 * Hàm THUẦN: không đọc DB, không đọc đồng hồ. Ngày lễ được TRUYỀN VÀO chứ không
 * tự tra — danh mục ngày lễ nằm ở bảng `holidays` và thay đổi theo từng năm,
 * kéo nó vào đây sẽ biến một hàm kiểm chứng được thành thứ phải dựng database
 * mới test nổi.
 */

export enum OvertimeRateType {
  WEEKDAY = 'weekday',
  WEEKEND = 'weekend',
  HOLIDAY = 'holiday',
}

const MINUTES_PER_DAY = 24 * 60;

export interface OvertimeSpanInput {
  /** Ngày làm thêm, `YYYY-MM-DD`. */
  workDate: string;
  /** Giờ bắt đầu, `HH:mm[:ss]`. */
  startTime: string;
  /**
   * Giờ kết thúc, `HH:mm[:ss]`. Nhỏ hơn hoặc bằng giờ bắt đầu nghĩa là SANG
   * NGÀY HÔM SAU (ca đêm 22:00–02:00 là chuyện bình thường ở nhà máy).
   */
  endTime: string;
  /** Ngày này có phải ngày lễ chính thức không — tra từ bảng `holidays`. */
  isHoliday: boolean;
}

export interface OvertimeSpanResult {
  totalHours: number;
  /** Phần giờ rơi vào khung ban đêm, tập con của `totalHours`. */
  nightHours: number;
  rateType: OvertimeRateType;
  /** Hệ số nền theo loại ngày (1.5 / 2 / 3). */
  rate: number;
  /** Phụ trội ca đêm (0 hoặc 0.3), CỘNG vào `rate` cho riêng phần `nightHours`. */
  nightRateSurcharge: number;
}

/**
 * Loại ngày làm thêm.
 *
 * Ngày lễ thắng cuối tuần: lễ rơi vào Chủ nhật vẫn là 3× chứ không phải 2×
 * (§7.1 xếp "ngày lễ, ngày nghỉ có lương" ở mức cao nhất).
 */
export function resolveRateType(
  workDate: string,
  isHoliday: boolean,
): OvertimeRateType {
  if (isHoliday) {
    return OvertimeRateType.HOLIDAY;
  }

  // `T00:00:00Z` để đọc thứ theo đúng ngày ghi trên đơn, không lệch theo
  // múi giờ của server (`new Date('2026-05-25')` đã là UTC, nhưng viết rõ ra
  // thì không ai phải nhớ điều đó).
  const dayOfWeek = new Date(`${workDate}T00:00:00Z`).getUTCDay();

  return dayOfWeek === 0 || dayOfWeek === 6
    ? OvertimeRateType.WEEKEND
    : OvertimeRateType.WEEKDAY;
}

const RATE_BY_TYPE: Record<OvertimeRateType, number> = {
  [OvertimeRateType.WEEKDAY]: OVERTIME_RATES.WEEKDAY,
  [OvertimeRateType.WEEKEND]: OVERTIME_RATES.WEEKEND,
  [OvertimeRateType.HOLIDAY]: OVERTIME_RATES.HOLIDAY,
};

export function calculateOvertimeSpan(
  input: OvertimeSpanInput,
): OvertimeSpanResult {
  const startMinutes = parseTimeToMinutes(input.startTime);
  const rawEndMinutes = parseTimeToMinutes(input.endTime);

  // Kết thúc <= bắt đầu nghĩa là vắt qua nửa đêm.
  const endMinutes =
    rawEndMinutes <= startMinutes
      ? rawEndMinutes + MINUTES_PER_DAY
      : rawEndMinutes;

  const totalMinutes = endMinutes - startMinutes;

  if (totalMinutes <= 0) {
    throw new Error(
      `overtime span "${input.startTime}"–"${input.endTime}" is empty`,
    );
  }

  const rateType = resolveRateType(input.workDate, input.isHoliday);
  const nightMinutes = nightMinutesWithin(startMinutes, endMinutes);

  return {
    totalHours: minutesToHours(totalMinutes),
    nightHours: minutesToHours(nightMinutes),
    rateType,
    rate: RATE_BY_TYPE[rateType],
    nightRateSurcharge: nightMinutes > 0 ? OVERTIME_RATES.NIGHT_SURCHARGE : 0,
  };
}

/**
 * Số phút của ca nằm trong khung ban đêm 22h–6h (Điều 106 BLLĐ 2019).
 *
 * Khung đêm vắt qua nửa đêm nên nó xuất hiện HAI LẦN trên trục thời gian của
 * một ca: khung của đêm hôm trước (kết thúc lúc 06:00 sáng nay) và khung của
 * đêm nay (bắt đầu lúc 22:00). Ca 05:00–08:00 chạm cái thứ nhất, ca 18:00–23:00
 * chạm cái thứ hai, ca 21:00–07:00 chạm cả hai. Chỉ xét một khung là mất giờ
 * đêm của một trong hai trường hợp.
 */
function nightMinutesWithin(startMinutes: number, endMinutes: number): number {
  const nightStart = parseTimeToMinutes(NIGHT_SHIFT_START_TIME);
  const nightEnd = parseTimeToMinutes(NIGHT_SHIFT_END_TIME);

  const windows: Array<[number, number]> = [
    // Đêm hôm trước kéo sang: 22:00 (hôm qua) → 06:00 (hôm nay).
    [nightStart - MINUTES_PER_DAY, nightEnd],
    // Đêm hôm nay: 22:00 (hôm nay) → 06:00 (ngày mai).
    [nightStart, nightEnd + MINUTES_PER_DAY],
    // Ca dài vắt sang tận đêm kế tiếp.
    [nightStart + MINUTES_PER_DAY, nightEnd + 2 * MINUTES_PER_DAY],
  ];

  return windows.reduce((total, [windowStart, windowEnd]) => {
    const overlap =
      Math.min(endMinutes, windowEnd) - Math.max(startMinutes, windowStart);
    return total + Math.max(0, overlap);
  }, 0);
}
