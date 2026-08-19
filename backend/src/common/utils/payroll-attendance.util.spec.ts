import { OvertimeRateType } from './overtime.util';
import {
  AttendanceRowInput,
  summariseAttendanceForPayroll,
} from './payroll-attendance.util';

/* 2026-05-04 thứ Hai · 2026-05-09 thứ Bảy · 2026-05-01 lễ (rơi vào thứ Sáu). */
const MONDAY = '2026-05-04';
const SATURDAY = '2026-05-09';
const HOLIDAY = '2026-05-01';

/** 22.000.000 ÷ 22 ngày ÷ 8 giờ = 125.000 đ/giờ — số tròn cho dễ đối chiếu. */
const HOURLY_RATE = 125_000;

function row(overrides: Partial<AttendanceRowInput> = {}): AttendanceRowInput {
  return {
    workDate: MONDAY,
    status: 'present',
    checkIn: '08:00',
    checkOut: '17:00',
    overtimeHours: 0,
    ...overrides,
  };
}

describe('summariseAttendanceForPayroll', () => {
  it('counts a day of attendance for every status that means "was at work"', () => {
    const summary = summariseAttendanceForPayroll({
      rows: [
        row({ status: 'present' }),
        row({ workDate: '2026-05-05', status: 'late' }),
        row({ workDate: '2026-05-06', status: 'early_leave' }),
        row({ workDate: '2026-05-07', status: 'wfh' }),
      ],
      holidays: new Set(),
      hourlyRate: HOURLY_RATE,
    });

    expect(summary.actualWorkingDays).toBe(4);
  });

  /*
   * Ngày nghỉ phép và ngày vắng KHÔNG phải ngày công thực tế. Phép CÓ LƯƠNG được
   * cộng riêng từ đơn nghỉ (biết loại phép nào có lương), không đếm ở đây.
   */
  it('does not count leave, absence or holidays as worked days', () => {
    const summary = summariseAttendanceForPayroll({
      rows: [
        row({ status: 'leave' }),
        row({ workDate: '2026-05-05', status: 'absent' }),
        row({ workDate: HOLIDAY, status: 'holiday' }),
      ],
      holidays: new Set([HOLIDAY]),
      hourlyRate: HOURLY_RATE,
    });

    expect(summary.actualWorkingDays).toBe(0);
  });

  it('pays weekday overtime at 1.5x', () => {
    const summary = summariseAttendanceForPayroll({
      rows: [row({ checkOut: '19:00', overtimeHours: 2 })],
      holidays: new Set(),
      hourlyRate: HOURLY_RATE,
    });

    expect(summary.overtimeHours).toBe(2);
    expect(summary.overtimePay).toBe(2 * HOURLY_RATE * 1.5);
    expect(summary.overtimeByRateType[OvertimeRateType.WEEKDAY]).toBe(2);
  });

  it('pays weekend overtime at 2x', () => {
    const summary = summariseAttendanceForPayroll({
      rows: [
        row({
          workDate: SATURDAY,
          checkIn: '08:00',
          checkOut: '12:00',
          overtimeHours: 4,
        }),
      ],
      holidays: new Set(),
      hourlyRate: HOURLY_RATE,
    });

    expect(summary.overtimePay).toBe(4 * HOURLY_RATE * 2);
    expect(summary.overtimeByRateType[OvertimeRateType.WEEKEND]).toBe(4);
  });

  /* Lễ thắng cuối tuần: 3× là mức cao nhất (§7.1). */
  it('pays holiday overtime at 3x', () => {
    const summary = summariseAttendanceForPayroll({
      rows: [
        row({
          workDate: HOLIDAY,
          checkIn: '08:00',
          checkOut: '12:00',
          overtimeHours: 4,
        }),
      ],
      holidays: new Set([HOLIDAY]),
      hourlyRate: HOURLY_RATE,
    });

    expect(summary.overtimePay).toBe(4 * HOURLY_RATE * 3);
    expect(summary.overtimeByRateType[OvertimeRateType.HOLIDAY]).toBe(4);
  });

  /*
   * Điều 98: làm thêm ban đêm ngày thường = 1.5 + 0.3 + 0.2 = 2.0 đơn giá, và
   * phụ trội CHỈ áp cho phần giờ nằm sau 22h.
   */
  it('adds the night surcharge only to the hours after 22:00', () => {
    const summary = summariseAttendanceForPayroll({
      // Làm thêm 21:00–23:00: 1 giờ ban ngày + 1 giờ ban đêm.
      rows: [row({ checkOut: '23:00', overtimeHours: 2 })],
      holidays: new Set(),
      hourlyRate: HOURLY_RATE,
    });

    expect(summary.overtimePay).toBe(
      HOURLY_RATE * 1.5 + HOURLY_RATE * (1.5 + 0.5),
    );
  });

  /*
   * Không có giờ ra thì không suy diễn được khoảng nào là giờ làm thêm. Giờ vẫn
   * được ghi nhận để người xem thấy, nhưng KHÔNG bịa ra tiền cho nó.
   */
  it('records the hours but pays nothing when the check-out is missing', () => {
    const summary = summariseAttendanceForPayroll({
      rows: [row({ checkOut: null, overtimeHours: 3 })],
      holidays: new Set(),
      hourlyRate: HOURLY_RATE,
    });

    expect(summary.overtimeHours).toBe(3);
    expect(summary.overtimePay).toBe(0);
  });

  it('adds up a whole month', () => {
    const summary = summariseAttendanceForPayroll({
      rows: [
        row({ checkOut: '18:00', overtimeHours: 1 }),
        row({ workDate: '2026-05-05', checkOut: '18:30', overtimeHours: 1.5 }),
        row({ workDate: '2026-05-06' }),
      ],
      holidays: new Set(),
      hourlyRate: HOURLY_RATE,
    });

    expect(summary.actualWorkingDays).toBe(3);
    expect(summary.overtimeHours).toBe(2.5);
    expect(summary.overtimePay).toBe(2.5 * HOURLY_RATE * 1.5);
  });
});
