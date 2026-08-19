import {
  OvertimeRateType,
  calculateOvertimeSpan,
  resolveRateType,
} from '@/common/utils/overtime.util';
import {
  formatMinutesToTime,
  parseTimeToMinutes,
} from '@/common/utils/work-hours.util';
import { roundVnd } from '@/common/utils/payroll.util';

/**
 * Quy dữ liệu chấm công của một tháng về những con số bảng lương cần
 * (business-rules.md §2.3, §7).
 *
 * HÀM THUẦN — nhận mảng bản ghi đã đọc sẵn, không chạm database. Ngày lễ được
 * truyền vào vì danh mục nằm ở bảng `holidays` và đổi theo từng năm.
 */

/** Trạng thái chấm công được tính là MỘT ngày công thực tế. */
const WORKED_STATUSES = new Set(['present', 'late', 'early_leave', 'wfh']);

export interface AttendanceRowInput {
  workDate: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  /** Giờ làm thêm đã tính sẵn ở phân hệ chấm công. */
  overtimeHours: number;
}

export interface AttendanceSummaryInput {
  rows: AttendanceRowInput[];
  /** Ngày lễ chính thức trong tháng, `YYYY-MM-DD`. */
  holidays: Set<string>;
  /** Đơn giá một giờ làm việc bình thường. */
  hourlyRate: number;
}

export interface AttendanceSummary {
  /** Số ngày có mặt làm việc — căn cứ tính lương theo ngày công. */
  actualWorkingDays: number;
  overtimeHours: number;
  overtimePay: number;
  /** Giờ làm thêm tách theo loại ngày — để đối chiếu khi bảng lương bị thắc mắc. */
  overtimeByRateType: Record<OvertimeRateType, number>;
}

/**
 * Tính ngày công và TIỀN làm thêm giờ.
 *
 * GIỜ LÀM THÊM NẰM Ở CUỐI CA. Bảng `attendances` lưu tổng số giờ làm thêm của
 * ngày chứ không lưu khoảng giờ nào là giờ làm thêm, mà phụ trội ca đêm lại phụ
 * thuộc đúng vào khoảng đó. Giả định ở đây: phần làm thêm là `overtimeHours` giờ
 * CUỐI CÙNG trước giờ ra. Đó là hình dạng thực tế của phần lớn ca làm — ở lại
 * sau giờ tan ca — và với ngày nghỉ thì cả ca vốn đã là làm thêm nên giả định
 * này trùng luôn với sự thật.
 *
 * Không có giờ ra thì KHÔNG suy diễn: bỏ qua phần tiền làm thêm của ngày đó và
 * để nó hiện ra ở `overtimeHours` là 0. Đoán một giờ ra để có số trả là bịa ra
 * tiền lương.
 */
export function summariseAttendanceForPayroll(
  input: AttendanceSummaryInput,
): AttendanceSummary {
  let actualWorkingDays = 0;
  let overtimeHours = 0;
  let overtimePay = 0;

  const overtimeByRateType: Record<OvertimeRateType, number> = {
    [OvertimeRateType.WEEKDAY]: 0,
    [OvertimeRateType.WEEKEND]: 0,
    [OvertimeRateType.HOLIDAY]: 0,
  };

  for (const row of input.rows) {
    if (WORKED_STATUSES.has(row.status)) {
      actualWorkingDays += 1;
    }

    if (row.overtimeHours <= 0) {
      continue;
    }

    const isHoliday = input.holidays.has(row.workDate);
    const rateType = resolveRateType(row.workDate, isHoliday);

    overtimeHours += row.overtimeHours;
    overtimeByRateType[rateType] += row.overtimeHours;

    if (!row.checkOut) {
      continue;
    }

    const endMinutes = parseTimeToMinutes(row.checkOut);
    const startMinutes = endMinutes - Math.round(row.overtimeHours * 60);

    const span = calculateOvertimeSpan({
      workDate: row.workDate,
      startTime: formatMinutesToTime(((startMinutes % 1440) + 1440) % 1440),
      endTime: row.checkOut,
      isHoliday,
    });

    /*
     * Giờ ban đêm ăn hệ số nền CỘNG phụ trội, giờ ban ngày chỉ ăn hệ số nền.
     * Áp phụ trội cho cả ca sẽ trả thừa cho phần ban ngày; bỏ qua nó thì trả
     * thiếu 50% đơn giá cho mỗi giờ làm thêm sau 22h.
     */
    const dayHours = span.totalHours - span.nightHours;

    overtimePay +=
      input.hourlyRate *
      (dayHours * span.rate +
        span.nightHours * (span.rate + span.nightRateSurcharge));
  }

  return {
    actualWorkingDays,
    overtimeHours: Number(overtimeHours.toFixed(2)),
    overtimePay: roundVnd(overtimePay),
    overtimeByRateType,
  };
}
