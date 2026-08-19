/**
 * Khung giờ làm việc và giới hạn làm thêm giờ.
 *
 * Giá trị lấy từ `docs/business-rules.md` §12.1 (khung giờ) và §7.2 (giới hạn
 * OT theo Điều 107 BLLĐ 2019).
 *
 * VÌ SAO LÀ HẰNG SỐ CHỨ KHÔNG PHẢI BẢN GHI CẤU HÌNH: schema hiện không có bảng
 * `settings`, và cả công ty đang dùng CHUNG một khung giờ. Ngày nào có ca kíp
 * (ca đêm, ca gãy, giờ riêng theo phòng ban) thì đây là chỗ duy nhất phải sửa
 * — mọi phép tính đọc từ đây, không có số giờ nào rải rác trong service.
 *
 * ⚠️ Đổi các giá trị này KHÔNG tính lại lịch sử: `attendances` lưu sẵn
 * `work_hours`, `late_minutes`... của từng ngày. Đó là chủ ý — bảng công tháng
 * trước phải giữ nguyên con số đã dùng để trả lương tháng trước.
 */

/** Giờ vào ca chuẩn — `HH:mm` (business-rules §12.1). */
export const WORK_START_TIME = '08:00';

/** Giờ tan ca chuẩn — `HH:mm` (business-rules §12.1). */
export const WORK_END_TIME = '17:00';

/** Nghỉ trưa, KHÔNG tính vào giờ công (business-rules §12.2). */
export const LUNCH_BREAK_MINUTES = 60;

/**
 * Vào sau giờ chuẩn quá ngần này phút mới tính đi muộn (business-rules §12.1).
 * Đúng 15 phút thì CHƯA muộn — tài liệu ghi "> 15 phút".
 */
export const LATE_THRESHOLD_MINUTES = 15;

/** Ra trước giờ tan ca quá ngần này phút mới tính về sớm (business-rules §12.1). */
export const EARLY_LEAVE_THRESHOLD_MINUTES = 15;

/**
 * Số giờ công của một ngày làm việc tiêu chuẩn.
 *
 * Suy ra từ chính khung giờ trên: 08:00→17:00 là 9 giờ, trừ 60 phút nghỉ trưa
 * còn 8. Viết rời thành hằng số vì §12.3 định nghĩa "làm thêm giờ = phần vượt
 * quá 8 giờ/ngày" — nếu ai đó đổi khung giờ mà quên đổi số này thì hai chỗ sẽ
 * nói hai đằng, nên có bài test khoá hai giá trị lại với nhau.
 */
export const STANDARD_WORK_HOURS_PER_DAY = 8;

/**
 * Giới hạn làm thêm giờ — Điều 107 BLLĐ 2019 (business-rules §7.2).
 *
 * `MAX_TOTAL_HOURS_PER_DAY` là TỔNG giờ có mặt trong ngày (giờ chuẩn + giờ làm
 * thêm), không phải riêng phần làm thêm.
 */
export const OVERTIME_LIMITS = {
  MAX_TOTAL_HOURS_PER_DAY: 12,
  MAX_HOURS_PER_MONTH: 40,
  MAX_HOURS_PER_YEAR: 200,
  /**
   * Trần 300 giờ/năm chỉ áp dụng cho một số ngành nghề, và phải có thoả thuận
   * với NLĐ + thông báo cơ quan lao động. Hệ thống KHÔNG tự nới lên mức này:
   * muốn dùng phải là một quyết định có hồ sơ, không phải một nhánh `if`.
   */
  MAX_HOURS_PER_YEAR_SPECIAL: 300,
} as const;

/**
 * Hệ số lương làm thêm — Điều 98 BLLĐ 2019 (business-rules §7.1).
 *
 * Để ở đây (chứ không ở module lương) vì đơn xin làm thêm phải chốt hệ số
 * NGAY LÚC DUYỆT: đơn duyệt tháng 5 mà tháng 7 công ty đổi hệ số thì tiền
 * tháng 5 không được đổi theo.
 */
export const OVERTIME_RATES = {
  /** Ngày thường T2–T6. */
  WEEKDAY: 1.5,
  /** Thứ 7, Chủ nhật. */
  WEEKEND: 2,
  /** Ngày lễ, ngày nghỉ có hưởng lương. */
  HOLIDAY: 3,
  /** Ban đêm 22h–6h: CỘNG THÊM vào hệ số trên, không thay thế. */
  NIGHT_SURCHARGE: 0.3,
} as const;

/** Khung giờ ban đêm theo Điều 106 BLLĐ 2019 — dùng cho phụ cấp ca đêm. */
export const NIGHT_SHIFT_START_TIME = '22:00';
export const NIGHT_SHIFT_END_TIME = '06:00';
