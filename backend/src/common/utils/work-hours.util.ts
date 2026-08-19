import {
  EARLY_LEAVE_THRESHOLD_MINUTES,
  LATE_THRESHOLD_MINUTES,
  LUNCH_BREAK_MINUTES,
  STANDARD_WORK_HOURS_PER_DAY,
  WORK_END_TIME,
  WORK_START_TIME,
} from '@/common/constants/attendance.constant';

/**
 * Tính giờ công từ giờ vào/ra (business-rules.md §12.2 và §12.3).
 *
 * Hàm THUẦN, không chạm DB và không đọc đồng hồ — mọi thứ nó cần đều nằm trong
 * tham số. Nhờ vậy quy tắc trả lương của công ty kiểm chứng được bằng test
 * thường, không cần dựng database hay giả lập thời gian.
 *
 * ĐƠN VỊ: mọi phép tính bên trong chạy bằng PHÚT (số nguyên). Cộng trừ giờ ở
 * dạng số thực sinh ra 8.399999999999999, mà đây là số nhân với đơn giá để ra
 * tiền lương. Chỉ đổi sang giờ đúng một lần ở bước cuối.
 */

/** `HH:mm` hoặc `HH:mm:ss` → số phút kể từ 00:00. */
export function parseTimeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());

  if (!match) {
    throw new Error(`Invalid time "${time}", expected HH:mm or HH:mm:ss`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    throw new Error(
      `Invalid time "${time}", hours must be 0-23 and minutes 0-59`,
    );
  }

  // Giây bị bỏ đi chứ không làm tròn: máy chấm công ghi 08:00:59 thì đó vẫn là
  // phút thứ 8:00, làm tròn lên sẽ biến người đúng giờ thành người đi muộn.
  return hours * 60 + minutes;
}

/** Số phút → `HH:mm`. */
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${`${hours}`.padStart(2, '0')}:${`${rest}`.padStart(2, '0')}`;
}

/** Phút → giờ, làm tròn 2 chữ số thập phân (khớp cột `DECIMAL(4,2)`). */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export interface WorkHoursInput {
  /** Giờ chấm vào, `HH:mm[:ss]`. */
  checkIn: string;
  /** Giờ chấm ra, `HH:mm[:ss]`. */
  checkOut: string;
}

export interface WorkHoursResult {
  /** Giờ công thực tế, ĐÃ trừ nghỉ trưa. */
  workHours: number;
  /**
   * Số giờ làm việc vượt quá một ngày công tiêu chuẩn.
   *
   * ⚠️ Đây là số giờ ĐÃ LÀM THỰC TẾ, KHÔNG PHẢI số giờ được trả tiền làm thêm.
   * Điều 107 BLLĐ 2019 yêu cầu làm thêm giờ phải có sự đồng ý của NLĐ, nên
   * tiền làm thêm chỉ trả theo đơn `overtime_requests` đã được duyệt. Con số ở
   * đây là bằng chứng thực tế: dùng để đối chiếu với đơn, và để phát hiện vi
   * phạm trần 12 giờ/ngày. Module lương (Giai đoạn 6) KHÔNG được lấy trực tiếp
   * số này làm căn cứ chi trả.
   */
  overtimeHours: number;
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave: boolean;
  earlyLeaveMinutes: number;
}

/**
 * Giờ công = (giờ ra − giờ vào) − nghỉ trưa.
 *
 * Nghỉ trưa chỉ bị trừ khi ca làm THỰC SỰ vắt qua giờ nghỉ. Trừ vô điều kiện
 * sẽ biến người làm ca sáng 08:00–11:00 thành 2 giờ công thay vì 3, và người
 * làm 30 phút thành giờ công ÂM.
 */
export function calculateWorkHours(input: WorkHoursInput): WorkHoursResult {
  const startMinutes = parseTimeToMinutes(WORK_START_TIME);
  const endMinutes = parseTimeToMinutes(WORK_END_TIME);
  const checkInMinutes = parseTimeToMinutes(input.checkIn);
  const checkOutMinutes = parseTimeToMinutes(input.checkOut);

  if (checkOutMinutes < checkInMinutes) {
    throw new Error(
      `check-out (${input.checkOut}) is earlier than check-in (${input.checkIn})`,
    );
  }

  const presentMinutes = checkOutMinutes - checkInMinutes;
  const workedMinutes = Math.max(
    0,
    presentMinutes - lunchBreakDeduction(checkInMinutes, checkOutMinutes),
  );

  const lateMinutes = Math.max(0, checkInMinutes - startMinutes);
  const earlyLeaveMinutes = Math.max(0, endMinutes - checkOutMinutes);
  const standardMinutes = STANDARD_WORK_HOURS_PER_DAY * 60;

  return {
    workHours: minutesToHours(workedMinutes),
    overtimeHours: minutesToHours(Math.max(0, workedMinutes - standardMinutes)),
    // "> 15 phút" (§12.1): đúng ngưỡng thì chưa tính là muộn.
    isLate: lateMinutes > LATE_THRESHOLD_MINUTES,
    lateMinutes,
    isEarlyLeave: earlyLeaveMinutes > EARLY_LEAVE_THRESHOLD_MINUTES,
    earlyLeaveMinutes,
  };
}

/**
 * Số phút nghỉ trưa phải trừ khỏi một ca làm.
 *
 * Chỉ trừ phần nghỉ trưa NẰM TRONG ca. Giờ nghỉ được đặt ngay trước giờ tan ca
 * chuẩn — với khung 08:00–17:00 và 60 phút nghỉ thì đó là 12:00–13:00, tức
 * đúng giờ nghỉ trưa thường thấy ở công ty Việt Nam, và tự dịch theo nếu ai đó
 * đổi khung giờ trong `attendance.constant.ts`.
 */
function lunchBreakDeduction(
  checkInMinutes: number,
  checkOutMinutes: number,
): number {
  if (LUNCH_BREAK_MINUTES <= 0) {
    return 0;
  }

  const startMinutes = parseTimeToMinutes(WORK_START_TIME);
  const endMinutes = parseTimeToMinutes(WORK_END_TIME);
  const shiftMinutes = endMinutes - startMinutes;
  const middleOffset = Math.floor((shiftMinutes - LUNCH_BREAK_MINUTES) / 2);
  const breakStart = startMinutes + middleOffset;
  const breakEnd = breakStart + LUNCH_BREAK_MINUTES;

  const overlapStart = Math.max(checkInMinutes, breakStart);
  const overlapEnd = Math.min(checkOutMinutes, breakEnd);

  return Math.max(0, overlapEnd - overlapStart);
}
