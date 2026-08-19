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

/**
 * Khung giờ nghỉ trưa CHUẨN của công ty — `HH:mm`.
 *
 * Trước đây chỉ có độ dài (60 phút) và khung giờ được SUY RA bằng cách đặt nó
 * vào giữa ca. Cách đó tình cờ ra đúng 12:00–13:00 với khung 08:00–17:00, nhưng
 * nó là một phép tính chứ không phải một quyết định: đổi giờ tan ca sang 18:00
 * thì giờ nghỉ tự trôi sang 12:30 mà không ai chọn điều đó.
 *
 * Đây là khung MẶC ĐỊNH, dùng khi bản ghi chấm công không mang theo giờ nghỉ
 * thực tế. Khi nền tảng chấm công ngoài có ghi giờ nghỉ thật, dữ liệu đó thắng
 * — xem `attendances.break_start` / `break_end`.
 */
export const BREAK_START_TIME = '12:00';
export const BREAK_END_TIME = '13:00';

/**
 * Độ dài nghỉ trưa chuẩn, tính từ chính khung giờ trên (business-rules §12.2).
 *
 * Suy ra chứ không viết cứng: hai con số nói cùng một điều thì sớm muộn cũng
 * lệch nhau, và bên lệch sẽ là bên không ai nhớ để sửa.
 */
export const LUNCH_BREAK_MINUTES =
  Number(BREAK_END_TIME.slice(0, 2)) * 60 +
  Number(BREAK_END_TIME.slice(3, 5)) -
  (Number(BREAK_START_TIME.slice(0, 2)) * 60 +
    Number(BREAK_START_TIME.slice(3, 5)));

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
  /**
   * Ban đêm 22h–6h: CỘNG THÊM vào hệ số trên, không thay thế.
   * Điều 98 khoản 2 BLLĐ 2019 — áp dụng cho mọi giờ làm ban đêm.
   */
  NIGHT_SURCHARGE: 0.3,
  /**
   * LÀM THÊM GIỜ vào ban đêm được cộng thêm 20% NỮA (Điều 98 khoản 3 BLLĐ 2019),
   * ngoài hệ số làm thêm ở khoản 1 và phụ trội ca đêm ở khoản 2.
   *
   * Vì sao tách riêng khỏi `NIGHT_SURCHARGE`: 30% dành cho mọi giờ làm ban đêm
   * (kể cả ca đêm bình thường, không phải làm thêm); 20% này CHỈ áp dụng khi giờ
   * ban đêm đó đồng thời là giờ làm thêm. Gộp hai khoản thành một số sẽ trả thừa
   * cho ca đêm chính thức và trả thiếu cho làm thêm ban đêm.
   *
   * Tổng làm thêm ban đêm ngày thường = 1.5 + 0.3 + 0.2 = 2.0 đơn giá ngày
   * thường (không phải 1.8 như bảng cũ trong business-rules.md §7.1).
   */
  NIGHT_OVERTIME_SURCHARGE: 0.2,
} as const;

/** Khung giờ ban đêm theo Điều 106 BLLĐ 2019 — dùng cho phụ cấp ca đêm. */
export const NIGHT_SHIFT_START_TIME = '22:00';
export const NIGHT_SHIFT_END_TIME = '06:00';
