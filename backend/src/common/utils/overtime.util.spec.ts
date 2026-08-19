import { OVERTIME_RATES } from '@/common/constants/attendance.constant';
import {
  OvertimeRateType,
  calculateOvertimeSpan,
  resolveRateType,
} from './overtime.util';

/* 2026-05-25 là thứ Hai, 2026-05-30 thứ Bảy, 2026-05-31 Chủ nhật. */
const MONDAY = '2026-05-25';
const SATURDAY = '2026-05-30';
const SUNDAY = '2026-05-31';

describe('overtime.util', () => {
  describe('resolveRateType', () => {
    it('treats Monday to Friday as a weekday', () => {
      expect(resolveRateType(MONDAY, false)).toBe(OvertimeRateType.WEEKDAY);
    });

    it.each([SATURDAY, SUNDAY])('treats %s as a weekend', (date) => {
      expect(resolveRateType(date, false)).toBe(OvertimeRateType.WEEKEND);
    });

    /*
     * §7.1 xếp ngày lễ ở mức cao nhất, nên lễ rơi vào Chủ nhật vẫn là 3× chứ
     * không tụt xuống 2×. Trả sai ở đây là trả thiếu tiền đúng vào ngày đắt
     * nhất của năm.
     */
    it('keeps a public holiday at the holiday rate even on a Sunday', () => {
      expect(resolveRateType(SUNDAY, true)).toBe(OvertimeRateType.HOLIDAY);
    });

    /*
     * `new Date('2026-05-25')` được đọc là UTC. Nếu ở đâu đó đọc thứ theo giờ
     * địa phương thì server chạy múi âm sẽ lùi một ngày và biến thứ Hai thành
     * Chủ nhật — tự nâng hệ số từ 1,5× lên 2×.
     */
    it('reads the weekday from the date itself, not the server timezone', () => {
      const original = process.env.TZ;
      process.env.TZ = 'America/New_York';

      try {
        expect(resolveRateType(MONDAY, false)).toBe(OvertimeRateType.WEEKDAY);
      } finally {
        process.env.TZ = original;
      }
    });
  });

  describe('calculateOvertimeSpan', () => {
    it('computes a plain evening overtime block', () => {
      const result = calculateOvertimeSpan({
        workDate: MONDAY,
        startTime: '18:00',
        endTime: '21:00',
        isHoliday: false,
      });

      expect(result.totalHours).toBe(3);
      expect(result.nightHours).toBe(0);
      expect(result.rate).toBe(OVERTIME_RATES.WEEKDAY);
      expect(result.nightRateSurcharge).toBe(0);
    });

    it('applies the weekend rate on Saturday', () => {
      expect(
        calculateOvertimeSpan({
          workDate: SATURDAY,
          startTime: '08:00',
          endTime: '12:00',
          isHoliday: false,
        }).rate,
      ).toBe(OVERTIME_RATES.WEEKEND);
    });

    it('applies the holiday rate', () => {
      expect(
        calculateOvertimeSpan({
          workDate: MONDAY,
          startTime: '08:00',
          endTime: '12:00',
          isHoliday: true,
        }).rate,
      ).toBe(OVERTIME_RATES.HOLIDAY);
    });

    describe('giờ ban đêm (22h–6h)', () => {
      it('counts the part after 22:00', () => {
        const result = calculateOvertimeSpan({
          workDate: MONDAY,
          startTime: '18:00',
          endTime: '23:00',
          isHoliday: false,
        });

        expect(result.totalHours).toBe(5);
        expect(result.nightHours).toBe(1);
        // Điều 98 khoản 2 (30% cho giờ ban đêm) CỘNG khoản 3 (thêm 20% khi giờ
        // ban đêm đó là giờ làm thêm — luôn đúng với hàm này).
        expect(result.nightRateSurcharge).toBe(
          OVERTIME_RATES.NIGHT_SURCHARGE +
            OVERTIME_RATES.NIGHT_OVERTIME_SURCHARGE,
        );
      });

      /**
       * Chốt con số cuối cùng, vì đây là chỗ trước đây trả thiếu tiền: một giờ
       * làm thêm ban đêm ngày thường phải là 2.0 đơn giá ngày thường
       * (1.5 + 0.3 + 0.2), không phải 1.8.
       */
      it('totals 2.0x for a weekday night overtime hour', () => {
        const result = calculateOvertimeSpan({
          workDate: MONDAY,
          startTime: '22:00',
          endTime: '23:00',
          isHoliday: false,
        });

        expect(result.nightHours).toBe(1);
        expect(result.rate + result.nightRateSurcharge).toBe(2);
      });

      /*
       * Khung đêm vắt qua nửa đêm nên nó nằm ở HAI phía của một ca sáng sớm.
       * Chỉ xét khung "22:00 hôm nay" thì ca 05:00–08:00 sẽ ra 0 giờ đêm.
       */
      it('counts the part before 06:00 on an early-morning block', () => {
        const result = calculateOvertimeSpan({
          workDate: MONDAY,
          startTime: '05:00',
          endTime: '08:00',
          isHoliday: false,
        });

        expect(result.totalHours).toBe(3);
        expect(result.nightHours).toBe(1);
      });

      it('counts both ends for a shift running through the night', () => {
        // 21:00 → 07:00 hôm sau = 10h. Trong đó khung đêm 22:00–06:00 nằm
        // trọn bên trong: 2h trước nửa đêm + 6h sau = 8h. Còn lại 21–22h và
        // 06–07h là giờ ngày.
        const result = calculateOvertimeSpan({
          workDate: MONDAY,
          startTime: '21:00',
          endTime: '07:00',
          isHoliday: false,
        });

        expect(result.totalHours).toBe(10);
        expect(result.nightHours).toBe(8);
      });

      it('leaves a daytime block with no night surcharge', () => {
        expect(
          calculateOvertimeSpan({
            workDate: SATURDAY,
            startTime: '08:00',
            endTime: '17:00',
            isHoliday: false,
          }).nightRateSurcharge,
        ).toBe(0);
      });
    });

    describe('ca vắt qua nửa đêm', () => {
      it('treats an end time before the start as the next day', () => {
        expect(
          calculateOvertimeSpan({
            workDate: MONDAY,
            startTime: '22:00',
            endTime: '02:00',
            isHoliday: false,
          }).totalHours,
        ).toBe(4);
      });

      /*
       * Không có ca dài 0 giờ. Nếu đọc "23:00–23:00" là 0 phút thì đơn rỗng sẽ
       * lọt vào DB; đọc là 24 giờ thì hợp lý hơn về mặt dữ liệu nhưng vẫn phải
       * bị service chặn vì vượt trần 12 giờ/ngày.
       */
      it('reads an identical start and end as a full 24 hours, not zero', () => {
        expect(
          calculateOvertimeSpan({
            workDate: MONDAY,
            startTime: '23:00',
            endTime: '23:00',
            isHoliday: false,
          }).totalHours,
        ).toBe(24);
      });
    });

    it('keeps fractional hours exact', () => {
      expect(
        calculateOvertimeSpan({
          workDate: MONDAY,
          startTime: '17:30',
          endTime: '19:15',
          isHoliday: false,
        }).totalHours,
      ).toBe(1.75);
    });
  });
});
