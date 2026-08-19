import {
  BASE_ANNUAL_LEAVE_DAYS,
  LeaveHalf,
  annualLeaveDays,
  countLeaveDays,
  floorToHalf,
  proratedFirstYearDays,
  seniorityYears,
  workingDaysBetween,
} from './leave.util';

/* 2026-05-04 là thứ Hai, 2026-05-08 thứ Sáu, 2026-05-09 thứ Bảy, 10 Chủ nhật. */
const MONDAY = '2026-05-04';
const FRIDAY = '2026-05-08';

describe('leave.util', () => {
  describe('annualLeaveDays – Điều 113', () => {
    it.each([
      [0, 12],
      [4, 12],
      [5, 13],
      [9, 13],
      [10, 14],
      [15, 15],
      [24, 16],
    ])('gives %i years of service %i days', (years, expected) => {
      expect(annualLeaveDays(years)).toBe(expected);
    });

    /* "Cứ đủ 05 năm làm việc" — 4 năm 11 tháng vẫn chưa được cộng. */
    it('rounds service down: a part-year adds nothing', () => {
      expect(annualLeaveDays(4.9)).toBe(BASE_ANNUAL_LEAVE_DAYS);
    });

    it('never returns less than the base for a negative input', () => {
      expect(annualLeaveDays(-3)).toBe(BASE_ANNUAL_LEAVE_DAYS);
    });
  });

  describe('seniorityYears', () => {
    /*
     * Đếm theo mốc kỷ niệm ngày vào làm, không phải chia số ngày cho 365 — sai
     * một ngày ở đây là chênh nhau nguyên một ngày phép.
     */
    it('counts anniversaries, so the day before is still the previous year', () => {
      expect(seniorityYears('2020-03-01', '2025-02-28')).toBe(4);
      expect(seniorityYears('2020-03-01', '2025-03-01')).toBe(5);
    });

    it('returns 0 for someone hired later than the reference date', () => {
      expect(seniorityYears('2026-01-01', '2025-06-01')).toBe(0);
    });
  });

  describe('proratedFirstYearDays – §8.3', () => {
    it('gives the full year to someone hired before it', () => {
      expect(proratedFirstYearDays('2024-06-01', 2026, 12)).toBe(12);
    });

    it('gives nothing for a year before the hire date', () => {
      expect(proratedFirstYearDays('2027-01-01', 2026, 12)).toBe(0);
    });

    it('counts the hire month when hired on or before the 15th', () => {
      // Vào 10/07 ⇒ 6 tháng (7–12) ⇒ 12 × 6/12 = 6.
      expect(proratedFirstYearDays('2026-07-10', 2026, 12)).toBe(6);
    });

    /* Nửa tháng đầu chưa đủ để hưởng trọn một tháng phép. */
    it('skips the hire month when hired after the 15th', () => {
      // Vào 20/07 ⇒ tính từ tháng 8 ⇒ 5 tháng ⇒ 12 × 5/12 = 5.
      expect(proratedFirstYearDays('2026-07-20', 2026, 12)).toBe(5);
    });

    /*
     * Hệ thống chỉ ghi được nửa ngày, nên 7,3 ngày là con số không tiêu được.
     * Làm tròn XUỐNG: cấp dư phép rồi đòi lại là việc không ai làm được.
     */
    it('floors to a half day rather than leaving an unusable fraction', () => {
      // Vào 05/03 ⇒ 10 tháng ⇒ 13 × 10/12 = 10.83 ⇒ 10.5.
      expect(proratedFirstYearDays('2026-03-05', 2026, 13)).toBe(10.5);
    });

    it('gives a full year to someone hired on 1 January', () => {
      expect(proratedFirstYearDays('2026-01-01', 2026, 12)).toBe(12);
    });

    it('gives nothing to someone hired in the second half of December', () => {
      expect(proratedFirstYearDays('2026-12-20', 2026, 12)).toBe(0);
    });
  });

  describe('floorToHalf', () => {
    it.each([
      [10.83, 10.5],
      [10.5, 10.5],
      [10.4, 10],
      [12, 12],
    ])('floors %f to %f', (input, expected) => {
      expect(floorToHalf(input)).toBe(expected);
    });
  });

  describe('workingDaysBetween', () => {
    it('excludes Saturday and Sunday', () => {
      // T2 04/05 → CN 10/05: chỉ 5 ngày làm việc.
      expect(workingDaysBetween(MONDAY, '2026-05-10', new Set())).toHaveLength(
        5,
      );
    });

    it('excludes public holidays', () => {
      const days = workingDaysBetween(MONDAY, FRIDAY, new Set(['2026-05-06']));

      expect(days).toHaveLength(4);
      expect(days).not.toContain('2026-05-06');
    });

    it('includes both ends of the range', () => {
      expect(workingDaysBetween(MONDAY, MONDAY, new Set())).toEqual([MONDAY]);
    });

    it('returns nothing for a range that is entirely a weekend', () => {
      expect(workingDaysBetween('2026-05-09', '2026-05-10', new Set())).toEqual(
        [],
      );
    });
  });

  describe('countLeaveDays – §8.2', () => {
    it('counts a plain working week as 5 days', () => {
      expect(countLeaveDays({ startDate: MONDAY, endDate: FRIDAY })).toBe(5);
    });

    /*
     * Nghỉ từ thứ Sáu đến thứ Hai là 2 ngày phép, không phải 4. Tính cả cuối
     * tuần là lấy mất của nhân viên những ngày họ vốn được nghỉ.
     */
    it('does not charge leave for the weekend in the middle', () => {
      expect(countLeaveDays({ startDate: FRIDAY, endDate: '2026-05-11' })).toBe(
        2,
      );
    });

    it('does not charge leave for a public holiday in the middle', () => {
      expect(
        countLeaveDays({
          startDate: MONDAY,
          endDate: FRIDAY,
          holidays: new Set(['2026-05-06']),
        }),
      ).toBe(4);
    });

    it('charges half a day for a morning-only start', () => {
      expect(
        countLeaveDays({
          startDate: MONDAY,
          endDate: FRIDAY,
          startHalf: LeaveHalf.AFTERNOON,
        }),
      ).toBe(4.5);
    });

    it('charges half a day at each end when both are half days', () => {
      expect(
        countLeaveDays({
          startDate: MONDAY,
          endDate: FRIDAY,
          startHalf: LeaveHalf.AFTERNOON,
          endHalf: LeaveHalf.MORNING,
        }),
      ).toBe(4);
    });

    /*
     * Một ngày mà cả hai đầu đều là nửa ngày thì vẫn là MỘT nửa ngày — trừ hai
     * lần sẽ ra 0, tức là nghỉ mà không mất phép.
     */
    it('charges a single half day for a one-day half-day request', () => {
      expect(
        countLeaveDays({
          startDate: MONDAY,
          endDate: MONDAY,
          startHalf: LeaveHalf.MORNING,
          endHalf: LeaveHalf.MORNING,
        }),
      ).toBe(0.5);
    });

    /*
     * Xin nghỉ nửa ngày thứ Bảy thì không có gì để trừ — trừ 0,5 sẽ lấy mất
     * nửa ngày phép cho một ngày vốn đã được nghỉ.
     */
    it('charges nothing for a half day that falls on a weekend', () => {
      expect(
        countLeaveDays({
          startDate: '2026-05-09',
          endDate: '2026-05-09',
          startHalf: LeaveHalf.MORNING,
        }),
      ).toBe(0);
    });

    it('charges nothing for a range that is entirely holidays and weekend', () => {
      expect(
        countLeaveDays({
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          holidays: new Set(['2026-05-08']),
        }),
      ).toBe(0);
    });

    it('never returns a negative number of days', () => {
      expect(
        countLeaveDays({
          startDate: '2026-05-09',
          endDate: '2026-05-10',
          startHalf: LeaveHalf.MORNING,
          endHalf: LeaveHalf.AFTERNOON,
        }),
      ).toBe(0);
    });
  });
});
