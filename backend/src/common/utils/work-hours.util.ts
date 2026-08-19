import {
  BREAK_END_TIME,
  BREAK_START_TIME,
  EARLY_LEAVE_THRESHOLD_MINUTES,
  LATE_THRESHOLD_MINUTES,
  LUNCH_BREAK_MINUTES,
  STANDARD_WORK_HOURS_PER_DAY,
  WORK_END_TIME,
  WORK_START_TIME,
} from '../constants/attendance.constant';

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
  /**
   * Giờ nghỉ THỰC TẾ nếu nền tảng chấm công ngoài có ghi lại.
   *
   * Có thì dùng, không có thì rơi về khung nghỉ chuẩn của công ty. Đây là lý do
   * nó tuỳ chọn chứ không bắt buộc: phần lớn máy chấm công chỉ ghi vào/ra, và
   * bắt buộc trường này sẽ khiến mọi bản ghi bình thường phải bịa ra giờ nghỉ.
   *
   * Chỉ nhận khi CÓ ĐỦ CẢ HAI đầu. Một nửa khoảng thời gian không tính được ra
   * số phút nào, và đoán nốt nửa kia là bịa dữ liệu trả lương.
   */
  breakStart?: string | null;
  breakEnd?: string | null;
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
    presentMinutes -
      breakDeduction(
        checkInMinutes,
        checkOutMinutes,
        input.breakStart,
        input.breakEnd,
      ),
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
 * Số phút nghỉ phải trừ khỏi một ca làm.
 *
 * HAI NGUỒN, ưu tiên rõ ràng:
 *   1. Giờ nghỉ THỰC TẾ do bản ghi mang theo (từ nền tảng chấm công ngoài).
 *   2. Khung nghỉ CHUẨN của công ty (`BREAK_START_TIME`–`BREAK_END_TIME`).
 *
 * Cả hai đều chỉ trừ phần NẰM TRONG ca. Trừ vô điều kiện sẽ biến ca sáng
 * 08:00–11:00 thành 2 giờ công thay vì 3, và ca 30 phút thành giờ công ÂM.
 *
 * Khoảng nghỉ do bản ghi mang theo được trừ ĐÚNG như nó ghi, kể cả khi rỗng.
 */
function breakDeduction(
  checkInMinutes: number,
  checkOutMinutes: number,
  breakStart?: string | null,
  breakEnd?: string | null,
): number {
  if (breakStart && breakEnd) {
    const start = parseTimeToMinutes(breakStart);
    const end = parseTimeToMinutes(breakEnd);

    /*
     * `>=` chứ không phải `>`: một khoảng nghỉ rỗng vẫn là dữ liệu hợp lệ, chỉ
     * là không có gì để trừ. Chỉ giờ nghỉ NGƯỢC (kết thúc trước khi bắt đầu)
     * mới là dữ liệu hỏng — trừ nó ra số âm, tức là CỘNG thêm giờ công.
     */
    if (end >= start) {
      return overlapMinutes(checkInMinutes, checkOutMinutes, start, end);
    }
  }

  if (LUNCH_BREAK_MINUTES <= 0) {
    return 0;
  }

  return overlapMinutes(
    checkInMinutes,
    checkOutMinutes,
    parseTimeToMinutes(BREAK_START_TIME),
    parseTimeToMinutes(BREAK_END_TIME),
  );
}

/** Số phút giao nhau của hai khoảng thời gian; 0 nếu rời nhau. */
function overlapMinutes(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}
