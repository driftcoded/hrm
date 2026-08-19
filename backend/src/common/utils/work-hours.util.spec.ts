import {
  BREAK_END_TIME,
  BREAK_START_TIME,
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

      it('counts every extra hour — this figure IS the payroll basis', () => {
        expect(
          calculateWorkHours({ checkIn: '08:00', checkOut: '21:00' })
            .overtimeHours,
        ).toBe(4);
      });

      /*
       * QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN: "1 phút cũng phải tính tiền". Không có ngưỡng
       * tối thiểu, không làm tròn xuống. Test này tồn tại để chặn việc ai đó
       * "dọn cho gọn" các con số lẻ — 1 phút làm thêm mà ra 0 giờ là ăn bớt.
       *
       * 1 phút = 1/60 giờ = 0,0167 → 0,02 ở cột DECIMAL(4,2).
       */
      it('pays a single minute past the standard day, never rounds it to zero', () => {
        const result = calculateWorkHours({
          checkIn: '08:00',
          checkOut: '17:01',
        });

        expect(result.overtimeHours).toBe(0.02);
        expect(result.overtimeHours).toBeGreaterThan(0);
      });
    });

    describe('ngày nghỉ tuần / ngày lễ (isRestDay)', () => {
      /*
       * Điều 98 khoản 1 điểm b/c trả 200%/300% cho CẢ CA làm vào ngày nghỉ, chứ
       * không phải chỉ phần vượt 8 giờ. Ca 4 giờ ngày thường không có giờ làm
       * thêm nào; đúng ca đó vào Chủ nhật thì cả 4 giờ đều là làm thêm.
       */
      it('counts the whole shift as overtime, not just the part past 8 hours', () => {
        const weekday = calculateWorkHours({
          checkIn: '08:00',
          checkOut: '12:00',
        });
        const restDay = calculateWorkHours({
          checkIn: '08:00',
          checkOut: '12:00',
          isRestDay: true,
        });

        expect(weekday.overtimeHours).toBe(0);
        expect(restDay.overtimeHours).toBe(4);
        expect(restDay.overtimeHours).toBe(restDay.workHours);
      });

      it('still counts the whole shift when it also runs past 8 hours', () => {
        const result = calculateWorkHours({
          checkIn: '08:00',
          checkOut: '19:00',
          isRestDay: true,
        });

        expect(result.workHours).toBe(10);
        expect(result.overtimeHours).toBe(10);
      });

      /*
       * Ngày nghỉ không có giờ bắt đầu nào để so, nên người vào lúc 10:00 làm bù
       * ngày thứ Bảy không phải là người "đi muộn" 2 tiếng.
       */
      it('never flags lateness or early leave on a rest day', () => {
        const result = calculateWorkHours({
          checkIn: '10:00',
          checkOut: '14:00',
          isRestDay: true,
        });

        expect(result.isLate).toBe(false);
        expect(result.lateMinutes).toBe(0);
        expect(result.isEarlyLeave).toBe(false);
        expect(result.earlyLeaveMinutes).toBe(0);
      });
    });

    describe('giờ nghỉ thực tế từ nền tảng ngoài', () => {
      /*
       * Khoảng nghỉ rỗng thì không có gì để trừ. Không phải một quy ước riêng —
       * chỉ là hệ quả của việc trừ đúng khoảng được ghi.
       */
      it('deducts nothing for an empty break range', () => {
        const worked = calculateWorkHours({
          checkIn: '08:00',
          checkOut: '17:00',
          breakStart: '12:00',
          breakEnd: '12:00',
        });

        expect(worked.workHours).toBe(9);
      });

      it('deducts a real break that is shorter than the standard one', () => {
        const result = calculateWorkHours({
          checkIn: '08:00',
          checkOut: '17:00',
          breakStart: '12:00',
          breakEnd: '12:30',
        });

        expect(result.workHours).toBe(8.5);
      });

      it('deducts a real break that is longer than the standard one', () => {
        const result = calculateWorkHours({
          checkIn: '08:00',
          checkOut: '17:00',
          breakStart: '11:30',
          breakEnd: '13:00',
        });

        expect(result.workHours).toBe(7.5);
      });

      /* Nghỉ ngoài ca thì không có gì để trừ. */
      it('ignores a break that falls outside the shift', () => {
        expect(
          calculateWorkHours({
            checkIn: '08:00',
            checkOut: '11:00',
            breakStart: '12:00',
            breakEnd: '13:00',
          }).workHours,
        ).toBe(3);
      });

      /*
       * Một nửa khoảng thời gian không tính được ra số phút nào. Rơi về khung
       * chuẩn thay vì đoán nốt nửa kia — đoán ở đây là bịa dữ liệu trả lương.
       */
      it('falls back to the standard window when only one end is known', () => {
        expect(
          calculateWorkHours({
            checkIn: '08:00',
            checkOut: '17:00',
            breakStart: '12:00',
            breakEnd: null,
          }).workHours,
        ).toBe(8);
      });

      /* Giờ nghỉ ngược là dữ liệu hỏng — không được trừ ÂM (thành cộng giờ). */
      it('falls back to the standard window on a reversed break', () => {
        expect(
          calculateWorkHours({
            checkIn: '08:00',
            checkOut: '17:00',
            breakStart: '13:00',
            breakEnd: '12:00',
          }).workHours,
        ).toBe(8);
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
  it('derives LUNCH_BREAK_MINUTES from the configured break window', () => {
    expect(LUNCH_BREAK_MINUTES).toBe(
      parseTimeToMinutes(BREAK_END_TIME) - parseTimeToMinutes(BREAK_START_TIME),
    );
  });

  /*
   * Khung nghỉ phải NẰM TRONG ca làm. Đặt giờ nghỉ ra ngoài ca thì không ngày
   * nào bị trừ, và mọi người bỗng dưng thừa một giờ công mỗi ngày.
   */
  it('keeps the break window inside the working shift', () => {
    expect(parseTimeToMinutes(BREAK_START_TIME)).toBeGreaterThanOrEqual(
      parseTimeToMinutes(WORK_START_TIME),
    );
    expect(parseTimeToMinutes(BREAK_END_TIME)).toBeLessThanOrEqual(
      parseTimeToMinutes(WORK_END_TIME),
    );
  });

  it('keeps STANDARD_WORK_HOURS_PER_DAY consistent with the configured shift', () => {
    const shiftMinutes =
      parseTimeToMinutes(WORK_END_TIME) - parseTimeToMinutes(WORK_START_TIME);

    expect(minutesToHours(shiftMinutes - LUNCH_BREAK_MINUTES)).toBe(
      STANDARD_WORK_HOURS_PER_DAY,
    );
  });
});
