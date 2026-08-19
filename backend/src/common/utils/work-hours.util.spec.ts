import {
  EARLY_LEAVE_THRESHOLD_MINUTES,
  LATE_THRESHOLD_MINUTES,
  LUNCH_BREAK_MINUTES,
  STANDARD_WORK_HOURS_PER_DAY,
  WORK_END_TIME,
  WORK_START_TIME,
} from '@/common/constants/attendance.constant';
import {
  calculateWorkHours,
  formatMinutesToTime,
  minutesToHours,
  parseTimeToMinutes,
} from './work-hours.util';

describe('work-hours.util', () => {
  describe('parseTimeToMinutes', () => {
    it.each([
      ['00:00', 0],
      ['08:00', 480],
      ['8:05', 485],
      ['17:30', 1050],
      ['23:59', 1439],
    ])('parses %s to %i minutes', (input, expected) => {
      expect(parseTimeToMinutes(input)).toBe(expected);
    });

    /*
     * Máy chấm công ghi cả giây. 08:00:59 phải là phút thứ 08:00 — làm tròn lên
     * sẽ đẩy người đến đúng giờ sang phía đi muộn.
     */
    it('drops seconds instead of rounding them up', () => {
      expect(parseTimeToMinutes('08:00:59')).toBe(480);
    });

    it.each(['', '8', '08-00', '25:00', '08:60', 'abc'])(
      'rejects %p',
      (input) => {
        expect(() => parseTimeToMinutes(input)).toThrow(/Invalid time/);
      },
    );
  });

  describe('formatMinutesToTime', () => {
    it.each([
      [0, '00:00'],
      [485, '08:05'],
      [1050, '17:30'],
    ])('formats %i minutes as %s', (input, expected) => {
      expect(formatMinutesToTime(input)).toBe(expected);
    });
  });

  describe('minutesToHours', () => {
    it('rounds to 2 decimals so the value fits DECIMAL(4,2)', () => {
      expect(minutesToHours(510)).toBe(8.5);
      expect(minutesToHours(485)).toBe(8.08);
      expect(minutesToHours(1)).toBe(0.02);
    });

    /*
     * Cột work_hours nhân với đơn giá để ra tiền. Cộng dồn số thực kiểu
     * 0.1+0.2 sẽ để lại đuôi rác trong phiếu lương.
     */
    it('never leaves a floating-point tail', () => {
      expect(minutesToHours(50).toString()).toBe('0.83');
      expect(minutesToHours(504).toString()).toBe('8.4');
    });
  });

  describe('calculateWorkHours', () => {
    /* PLAN §4.1 — bài test đầu tiên của giai đoạn, viết nguyên văn. */
    it('counts 08:00 to 17:30 as 8.5 hours (PLAN 4.1)', () => {
      const result = calculateWorkHours({
        checkIn: '08:00',
        checkOut: '17:30',
      });

      expect(result.workHours).toBe(8.5);
      expect(result.isLate).toBe(false);
      expect(result.isEarlyLeave).toBe(false);
    });

    it('deducts the lunch break from a full standard day', () => {
      const result = calculateWorkHours({
        checkIn: WORK_START_TIME,
        checkOut: WORK_END_TIME,
      });

      expect(result.workHours).toBe(STANDARD_WORK_HOURS_PER_DAY);
      expect(result.overtimeHours).toBe(0);
    });

    /*
     * Trừ nghỉ trưa vô điều kiện sẽ biến ca sáng 3 tiếng thành 2, và ca 30 phút
     * thành giờ công ÂM. Chỉ trừ phần nghỉ trưa thực sự nằm trong ca.
     */
    it('does not deduct lunch from a shift that ends before it', () => {
      expect(
        calculateWorkHours({ checkIn: '08:00', checkOut: '11:00' }).workHours,
      ).toBe(3);
    });

    it('does not deduct lunch from a shift that starts after it', () => {
      expect(
        calculateWorkHours({ checkIn: '13:00', checkOut: '17:00' }).workHours,
      ).toBe(4);
    });

    it('deducts only the overlapping part of the lunch break', () => {
      // Ca 11:30–12:30 dài 60 phút, nhưng chỉ nửa sau chồng lên giờ nghỉ
      // 12:00–13:00 → trừ 30 phút, còn 30 phút công.
      expect(
        calculateWorkHours({ checkIn: '11:30', checkOut: '12:30' }).workHours,
      ).toBe(0.5);
      // Ca 11:30–13:00 thì chứa TRỌN giờ nghỉ → trừ đủ 60 phút.
      expect(
        calculateWorkHours({ checkIn: '11:30', checkOut: '13:00' }).workHours,
      ).toBe(0.5);
    });

    it('never returns negative hours for a very short shift', () => {
      expect(
        calculateWorkHours({ checkIn: '12:10', checkOut: '12:20' }).workHours,
      ).toBe(0);
    });

    describe('đi muộn', () => {
      it('treats exactly the threshold as on time (business-rules says "> 15")', () => {
        const onTime = calculateWorkHours({
          checkIn: '08:15',
          checkOut: '17:00',
        });

        expect(onTime.lateMinutes).toBe(LATE_THRESHOLD_MINUTES);
        expect(onTime.isLate).toBe(false);
      });

      it('flags one minute past the threshold', () => {
        const late = calculateWorkHours({
          checkIn: '08:16',
          checkOut: '17:00',
        });

        expect(late.lateMinutes).toBe(16);
        expect(late.isLate).toBe(true);
      });

      it('records early arrival as zero late minutes, not negative', () => {
        expect(
          calculateWorkHours({ checkIn: '07:30', checkOut: '17:00' })
            .lateMinutes,
        ).toBe(0);
      });
    });

    describe('về sớm', () => {
      it('treats exactly the threshold as a full day', () => {
        const result = calculateWorkHours({
          checkIn: '08:00',
          checkOut: '16:45',
        });

        expect(result.earlyLeaveMinutes).toBe(EARLY_LEAVE_THRESHOLD_MINUTES);
        expect(result.isEarlyLeave).toBe(false);
      });

      it('flags one minute past the threshold', () => {
        const result = calculateWorkHours({
          checkIn: '08:00',
          checkOut: '16:44',
        });

        expect(result.earlyLeaveMinutes).toBe(16);
        expect(result.isEarlyLeave).toBe(true);
      });

      it('records staying late as zero early-leave minutes, not negative', () => {
        expect(
          calculateWorkHours({ checkIn: '08:00', checkOut: '19:00' })
            .earlyLeaveMinutes,
        ).toBe(0);
      });
    });

    describe('giờ vượt ngày công chuẩn', () => {
      it('reports the excess over a standard day', () => {
        // 08:00–19:00 = 11h có mặt − 1h nghỉ = 10h làm, vượt 2h.
        expect(
          calculateWorkHours({ checkIn: '08:00', checkOut: '19:00' })
            .overtimeHours,
        ).toBe(2);
      });

      it('reports zero when the day is short, never a negative', () => {
        expect(
          calculateWorkHours({ checkIn: '09:00', checkOut: '15:00' })
            .overtimeHours,
        ).toBe(0);
      });

      /*
       * Ai đó đọc lướt sẽ tưởng đây là số giờ được trả tiền làm thêm. Không
       * phải: Điều 107 BLLĐ 2019 đòi làm thêm giờ phải có sự đồng ý của NLĐ,
       * nên tiền chỉ trả theo đơn đã duyệt. Ở lại muộn một mình không tạo ra
       * nghĩa vụ chi trả nào cho công ty.
       */
      it('counts unapproved extra hours too — this figure is evidence, not payroll', () => {
        expect(
          calculateWorkHours({ checkIn: '08:00', checkOut: '21:00' })
            .overtimeHours,
        ).toBe(4);
      });
    });

    it('rejects a check-out earlier than the check-in', () => {
      expect(() =>
        calculateWorkHours({ checkIn: '17:00', checkOut: '08:00' }),
      ).toThrow(/earlier than check-in/);
    });

    it('accepts a check-out equal to the check-in as a zero-hour day', () => {
      expect(
        calculateWorkHours({ checkIn: '08:00', checkOut: '08:00' }).workHours,
      ).toBe(0);
    });
  });

  /*
   * STANDARD_WORK_HOURS_PER_DAY được viết rời khỏi khung giờ, nên nó có thể
   * lệch với khung giờ mà không ai biết. Bài test này buộc hai chỗ phải đi
   * cùng nhau: đổi khung giờ mà quên đổi số giờ chuẩn thì đỏ ngay tại đây.
   */
  it('keeps STANDARD_WORK_HOURS_PER_DAY consistent with the configured shift', () => {
    const shiftMinutes =
      parseTimeToMinutes(WORK_END_TIME) - parseTimeToMinutes(WORK_START_TIME);

    expect(minutesToHours(shiftMinutes - LUNCH_BREAK_MINUTES)).toBe(
      STANDARD_WORK_HOURS_PER_DAY,
    );
  });
});
