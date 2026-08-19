import {
  MinimumWageRegion,
  payrollConstantsFor,
} from '@/common/constants/payroll.constant';
import {
  calculateEmployeeInsurance,
  calculateNetSalary,
  calculatePersonalIncomeTax,
  dailyRate,
  hourlyRate,
  prorateByWorkedDays,
  standardWorkingDaysInMonth,
} from './payroll.util';

/*
 * Mọi con số trong file này đối chiếu với `docs/business-rules.md`. Sai một
 * hằng số ở đây là trả sai lương cho cả công ty, nên test bám vào số cụ thể
 * chứ không kiểm tra kiểu "lớn hơn 0".
 */

describe('payrollConstantsFor', () => {
  it('uses the reference salary of the payroll period, not of today', () => {
    // Mốc đổi mức tham chiếu là 01/07/2026 (NĐ 161/2026/NĐ-CP).
    expect(payrollConstantsFor(2026, 6).referenceSalary).toBe(2_340_000);
    expect(payrollConstantsFor(2026, 7).referenceSalary).toBe(2_530_000);
    expect(payrollConstantsFor(2027, 1).referenceSalary).toBe(2_530_000);
  });

  it('derives the insurance cap as 20x the reference salary', () => {
    expect(payrollConstantsFor(2026, 6).socialInsuranceCap).toBe(46_800_000);
    expect(payrollConstantsFor(2026, 7).socialInsuranceCap).toBe(50_600_000);
  });

  it('carries the 2026 personal deductions', () => {
    const constants = payrollConstantsFor(2026, 8);

    expect(constants.selfDeduction).toBe(15_500_000);
    expect(constants.dependentDeduction).toBe(6_200_000);
  });

  /*
   * Trước 2026 là biểu 7 bậc và giảm trừ 11tr/4,4tr. Hệ thống không cài bộ số
   * đó — chạy im lặng sẽ trả ra một bảng lương trông hợp lệ nhưng sai.
   */
  it('refuses a payroll period before the supported law', () => {
    expect(() => payrollConstantsFor(2025, 12)).toThrow(RangeError);
  });
});

describe('standardWorkingDaysInMonth', () => {
  it('counts Mon-Fri only', () => {
    // Tháng 5/2026 bắt đầu vào thứ Sáu, có 21 ngày T2–T6.
    expect(standardWorkingDaysInMonth(2026, 5)).toBe(21);
    // Tháng 2/2026 bắt đầu vào Chủ nhật, 28 ngày, đúng 20 ngày làm việc.
    expect(standardWorkingDaysInMonth(2026, 2)).toBe(20);
  });

  it('subtracts public holidays that fall on a working day', () => {
    const holidays = new Set(['2026-05-01']);

    expect(standardWorkingDaysInMonth(2026, 5, holidays)).toBe(20);
  });

  /*
   * Lễ rơi vào cuối tuần vốn đã không nằm trong ngày làm việc; trừ tiếp là trừ
   * hai lần và làm lương ngày phình lên.
   */
  it('does not subtract a holiday that falls on a weekend', () => {
    // 02/05/2026 là thứ Bảy.
    const holidays = new Set(['2026-05-02']);

    expect(standardWorkingDaysInMonth(2026, 5, holidays)).toBe(21);
  });
});

describe('dailyRate / hourlyRate', () => {
  it('splits the monthly salary across the standard working days', () => {
    expect(dailyRate(22_000_000, 22)).toBe(1_000_000);
    expect(hourlyRate(22_000_000, 22)).toBe(125_000);
  });

  it('returns 0 instead of dividing by zero', () => {
    expect(dailyRate(20_000_000, 0)).toBe(0);
    expect(hourlyRate(20_000_000, 0)).toBe(0);
  });
});

describe('prorateByWorkedDays', () => {
  /* PLAN 6.1: nghỉ 2 ngày không phép trên tháng 22 ngày công. */
  it('cuts the pay for unpaid days off', () => {
    expect(prorateByWorkedDays(20_000_000, 22, 20)).toBe(18_181_818);
  });

  it('pays the full month when every standard day is worked', () => {
    expect(prorateByWorkedDays(20_000_000, 22, 22)).toBe(20_000_000);
  });

  /*
   * KHÔNG chặn trên ở 100%: đi làm bù thêm ngày công thì phần vượt vẫn phải
   * được trả, chặn lại là âm thầm ăn bớt.
   */
  it('pays beyond the month when extra days were worked', () => {
    expect(prorateByWorkedDays(20_000_000, 22, 23)).toBe(20_909_091);
  });
});

describe('calculateEmployeeInsurance', () => {
  /* PLAN 6.1: lương đóng BH 20tr → 1,6tr + 300k + 200k. */
  it('applies 8% / 1.5% / 1% to the contract salary', () => {
    const result = calculateEmployeeInsurance({
      insuranceSalary: 20_000_000,
      region: MinimumWageRegion.I,
      year: 2026,
      month: 8,
    });

    expect(result.socialInsurance).toBe(1_600_000);
    expect(result.healthInsurance).toBe(300_000);
    expect(result.unemploymentInsurance).toBe(200_000);
    expect(result.total).toBe(2_100_000);
  });

  it('caps the social and health base at 20x the reference salary', () => {
    const may = calculateEmployeeInsurance({
      insuranceSalary: 60_000_000,
      region: MinimumWageRegion.I,
      year: 2026,
      month: 5,
    });

    expect(may.insuranceBase).toBe(46_800_000);
    expect(may.socialInsurance).toBe(3_744_000);
    expect(may.healthInsurance).toBe(702_000);

    // Cùng mức lương, kỳ lương sau 01/07/2026 → trần cao hơn, đóng nhiều hơn.
    const august = calculateEmployeeInsurance({
      insuranceSalary: 60_000_000,
      region: MinimumWageRegion.I,
      year: 2026,
      month: 8,
    });

    expect(august.insuranceBase).toBe(50_600_000);
    expect(august.socialInsurance).toBe(4_048_000);
    expect(august.healthInsurance).toBe(759_000);
  });

  /*
   * BHTN có trần RIÊNG — 20 × lương tối thiểu VÙNG, không phải trần BHXH. Dùng
   * chung một trần sẽ tính sai BHTN của mọi người lương cao.
   */
  it('caps unemployment insurance by the regional minimum wage instead', () => {
    const regionI = calculateEmployeeInsurance({
      insuranceSalary: 60_000_000,
      region: MinimumWageRegion.I,
      year: 2026,
      month: 8,
    });

    // Trần vùng I = 5.310.000 × 20 = 106,2tr ⇒ chưa chạm trần.
    expect(regionI.unemploymentBase).toBe(60_000_000);
    expect(regionI.unemploymentInsurance).toBe(600_000);

    const regionIV = calculateEmployeeInsurance({
      insuranceSalary: 80_000_000,
      region: MinimumWageRegion.IV,
      year: 2026,
      month: 8,
    });

    // Trần vùng IV = 3.700.000 × 20 = 74tr ⇒ bị chặn.
    expect(regionIV.unemploymentBase).toBe(74_000_000);
    expect(regionIV.unemploymentInsurance).toBe(740_000);
  });
});

describe('calculateEmployeeInsurance — miễn đóng khi nghỉ dài', () => {
  /*
   * Điều 42 QĐ 595/QĐ-BHXH: nghỉ không lương từ 14 ngày làm việc trở lên trong
   * tháng thì tháng đó không đóng. Thiếu quy tắc này, người nghỉ trọn tháng vẫn
   * bị trừ 10,5% trên lương hợp đồng dù gần như không có thu nhập — và bảng
   * lương ra số ÂM.
   */
  it('charges nothing when 14 or more working days were unpaid', () => {
    const result = calculateEmployeeInsurance({
      insuranceSalary: 20_000_000,
      region: MinimumWageRegion.I,
      year: 2026,
      month: 8,
      unpaidWorkingDays: 14,
    });

    expect(result.total).toBe(0);
    expect(result.insuranceBase).toBe(0);
  });

  it('still charges in full at 13 unpaid days', () => {
    const result = calculateEmployeeInsurance({
      insuranceSalary: 20_000_000,
      region: MinimumWageRegion.I,
      year: 2026,
      month: 8,
      unpaidWorkingDays: 13,
    });

    expect(result.total).toBe(2_100_000);
  });

  /*
   * Hệ quả phải kiểm: người không đi làm ngày nào thì lương thực nhận bằng 0,
   * KHÔNG âm. Một bảng lương trả về số âm nghĩa là công ty đang đòi tiền nhân
   * viên, và không ai đọc con số đó mà hiểu được vì sao.
   */
  it('never turns a no-work month into a negative net', () => {
    const result = calculateNetSalary({
      year: 2026,
      month: 8,
      baseSalary: 0,
      insuranceSalary: 20_000_000,
      region: MinimumWageRegion.I,
      unpaidWorkingDays: 21,
    });

    expect(result.totalInsurance).toBe(0);
    expect(result.netSalary).toBe(0);
  });
});

describe('calculatePersonalIncomeTax', () => {
  /* Biểu 5 bậc từ 01/01/2026 (Luật 109/2025/QH15). */
  it('applies bracket 1 (up to 10m, 5%)', () => {
    expect(calculatePersonalIncomeTax(8_000_000, 2026, 8)).toBe(400_000);
  });

  it('applies bracket 2 (10m-30m, 10% minus 500k)', () => {
    // Ví dụ in trong business-rules.md §4.1.
    expect(calculatePersonalIncomeTax(25_000_000, 2026, 8)).toBe(2_000_000);
  });

  it('applies bracket 3 (30m-60m, 20% minus 3.5m)', () => {
    expect(calculatePersonalIncomeTax(50_000_000, 2026, 8)).toBe(6_500_000);
  });

  it('applies bracket 4 (60m-100m, 30% minus 9.5m)', () => {
    expect(calculatePersonalIncomeTax(80_000_000, 2026, 8)).toBe(14_500_000);
  });

  it('applies bracket 5 (above 100m, 35% minus 14.5m)', () => {
    expect(calculatePersonalIncomeTax(150_000_000, 2026, 8)).toBe(38_000_000);
  });

  /*
   * Biểu lũy tiến phải LIỀN MẠCH ở mỗi mốc: hai công thức kề nhau cho cùng một
   * con số. Lệch ở đây nghĩa là một `quickDeduction` sai, và cái sai đó chỉ lộ
   * ra với đúng những người có thu nhập quanh mốc.
   */
  it.each([
    [10_000_000, 500_000],
    [30_000_000, 2_500_000],
    [60_000_000, 8_500_000],
    [100_000_000, 20_500_000],
  ])('is continuous at the %d boundary', (income, expected) => {
    expect(calculatePersonalIncomeTax(income, 2026, 8)).toBe(expected);
  });

  it('never refunds tax when the taxable income is zero or negative', () => {
    expect(calculatePersonalIncomeTax(0, 2026, 8)).toBe(0);
    expect(calculatePersonalIncomeTax(-5_000_000, 2026, 8)).toBe(0);
  });
});

describe('calculateNetSalary', () => {
  /**
   * Ví dụ minh hoạ của business-rules.md §6 — từng dòng một.
   *
   * Đây là bài test quan trọng nhất của module lương: nó khoá toàn bộ chuỗi 8
   * bước vào một con số mà tài liệu nghiệp vụ đã công bố.
   */
  it('matches the worked example in business-rules.md §6', () => {
    const result = calculateNetSalary({
      year: 2026,
      month: 8,
      baseSalary: 20_000_000,
      positionAllowance: 2_000_000,
      mealAllowance: 730_000,
      transportAllowance: 500_000,
      phoneAllowance: 300_000,
      insuranceSalary: 20_000_000,
      region: MinimumWageRegion.I,
      dependentCount: 1,
    });

    expect(result.grossSalary).toBe(23_530_000);
    expect(result.totalInsurance).toBe(2_100_000);
    expect(result.taxExemptAllowance).toBe(1_530_000);
    expect(result.assessableIncome).toBe(22_000_000);
    expect(result.selfDeduction).toBe(15_500_000);
    expect(result.dependentDeduction).toBe(6_200_000);
    // 22.000.000 − 2.100.000 − 21.700.000 = −1.800.000 ⇒ sàn 0.
    expect(result.taxableIncome).toBe(0);
    expect(result.personalIncomeTax).toBe(0);
    expect(result.netSalary).toBe(21_430_000);
  });

  /* PLAN 6.1: thêm một người phụ thuộc phải giảm trừ thêm 6,2tr (luật 2026). */
  it('adds 6.2m of deduction per dependent', () => {
    const base = {
      year: 2026,
      month: 8,
      baseSalary: 50_000_000,
      insuranceSalary: 50_000_000,
      region: MinimumWageRegion.I,
    } as const;

    const none = calculateNetSalary({ ...base, dependentCount: 0 });
    const one = calculateNetSalary({ ...base, dependentCount: 1 });

    expect(none.taxableIncome - one.taxableIncome).toBe(6_200_000);
    expect(one.dependentDeduction).toBe(6_200_000);
  });

  /*
   * Bữa ăn giữa ca chỉ miễn thuế tới 730.000. Miễn cả khoản là cách một công ty
   * trả 5 triệu "tiền ăn" để né thuế.
   */
  it('exempts the meal allowance only up to the legal ceiling', () => {
    const result = calculateNetSalary({
      year: 2026,
      month: 8,
      baseSalary: 30_000_000,
      mealAllowance: 2_000_000,
      insuranceSalary: 30_000_000,
      region: MinimumWageRegion.I,
    });

    expect(result.taxExemptAllowance).toBe(730_000);
    expect(result.assessableIncome).toBe(32_000_000 - 730_000);
  });

  /*
   * Bảo hiểm trừ vào thu nhập TÍNH thuế, giảm trừ gia cảnh đứng SAU nó. Đảo thứ
   * tự không lệch chút ít mà đổi hẳn bậc thuế.
   */
  it('follows the order gross - exempt - insurance - deductions', () => {
    const result = calculateNetSalary({
      year: 2026,
      month: 8,
      baseSalary: 60_000_000,
      insuranceSalary: 20_000_000,
      region: MinimumWageRegion.I,
      dependentCount: 0,
    });

    expect(result.totalInsurance).toBe(2_100_000);
    // 60.000.000 − 0 − 2.100.000 − 15.500.000 = 42.400.000 ⇒ bậc 3.
    expect(result.taxableIncome).toBe(42_400_000);
    expect(result.personalIncomeTax).toBe(
      Math.round(42_400_000 * 0.2 - 3_500_000),
    );
    expect(result.netSalary).toBe(
      60_000_000 - 2_100_000 - result.personalIncomeTax,
    );
  });

  /* PLAN 6.1: tạm ứng 5tr bị trừ vào lương net của tháng đó. */
  it('subtracts the advance after tax, not before', () => {
    const base = {
      year: 2026,
      month: 8,
      baseSalary: 40_000_000,
      insuranceSalary: 20_000_000,
      region: MinimumWageRegion.I,
    } as const;

    const without = calculateNetSalary(base);
    const withAdvance = calculateNetSalary({
      ...base,
      advanceDeduction: 5_000_000,
    });

    // Tạm ứng là tiền đã trả trước, không phải chi phí làm giảm thu nhập.
    expect(withAdvance.taxableIncome).toBe(without.taxableIncome);
    expect(withAdvance.personalIncomeTax).toBe(without.personalIncomeTax);
    expect(without.netSalary - withAdvance.netSalary).toBe(5_000_000);
  });

  it('counts overtime pay and bonuses into gross', () => {
    const result = calculateNetSalary({
      year: 2026,
      month: 8,
      baseSalary: 20_000_000,
      overtimePay: 3_000_000,
      performanceBonus: 2_000_000,
      otherIncome: 500_000,
      insuranceSalary: 20_000_000,
      region: MinimumWageRegion.I,
    });

    expect(result.grossSalary).toBe(25_500_000);
    // Làm thêm giờ và thưởng KHÔNG được miễn thuế.
    expect(result.taxExemptAllowance).toBe(0);
  });
});
