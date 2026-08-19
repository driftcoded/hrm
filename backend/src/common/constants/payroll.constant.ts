/**
 * Hằng số tính lương Việt Nam (business-rules.md §1, §3, §4, §5).
 *
 * MỌI HẰNG SỐ Ở ĐÂY LÀ SỐ CỦA MỘT MỐC THỜI GIAN, không phải hằng số vĩnh viễn.
 * Mức tham chiếu đổi giữa năm 2026, biểu thuế đổi từ 01/01/2026, giảm trừ gia
 * cảnh đổi từ 01/01/2026. Bảng lương tháng 5 và bảng lương tháng 8 của cùng năm
 * 2026 phải dùng hai bộ số khác nhau — nên cách duy nhất an toàn là hỏi
 * `payrollConstantsFor(year, month)` chứ không đọc thẳng hằng số.
 *
 * Căn cứ: Luật BHXH 2024 (41/2024/QH15), Luật Việc làm 2025, Luật 109/2025/QH15,
 * Nghị quyết 110/2025/UBTVQH15, NĐ 293/2025/NĐ-CP, NĐ 161/2026/NĐ-CP.
 */

/** Vùng lương tối thiểu (NĐ 293/2025/NĐ-CP, áp dụng từ 01/01/2026). */
export enum MinimumWageRegion {
  I = 1,
  II = 2,
  III = 3,
  IV = 4,
}

/** Lương tối thiểu vùng, VNĐ/tháng — trần đóng BHTN tính từ đây. */
export const REGION_MINIMUM_WAGE: Record<MinimumWageRegion, number> = {
  [MinimumWageRegion.I]: 5_310_000,
  [MinimumWageRegion.II]: 4_730_000,
  [MinimumWageRegion.III]: 4_140_000,
  [MinimumWageRegion.IV]: 3_700_000,
};

/**
 * Mức tham chiếu — thay "lương cơ sở" làm căn cứ trần BHXH/BHYT cho khu vực
 * ngoài nhà nước (Luật 41/2024/QH15).
 */
const REFERENCE_SALARY_BEFORE_2026_07 = 2_340_000;
const REFERENCE_SALARY_FROM_2026_07 = 2_530_000;

/** Trần đóng bảo hiểm tính bằng bội số của mức tham chiếu / lương tối thiểu. */
export const INSURANCE_CAP_MULTIPLIER = 20;

/** Tỷ lệ NGƯỜI LAO ĐỘNG đóng (business-rules.md §3.2). Tổng 10,5%. */
export const EMPLOYEE_INSURANCE_RATES = {
  SOCIAL: 0.08,
  HEALTH: 0.015,
  UNEMPLOYMENT: 0.01,
} as const;

/**
 * Phụ cấp bữa ăn giữa ca được MIỄN thuế TNCN tới mức này (TT 111/2013/TT-BTC).
 * Phần vượt vẫn chịu thuế.
 */
export const TAX_EXEMPT_MEAL_ALLOWANCE = 730_000;

/**
 * Nghỉ KHÔNG LƯƠNG từ ngần này ngày làm việc trở lên trong tháng thì tháng đó
 * KHÔNG đóng bảo hiểm (Điều 42 Quyết định 595/QĐ-BHXH).
 *
 * Không có quy tắc này thì một người nghỉ trọn tháng vẫn bị trừ 10,5% trên lương
 * hợp đồng trong khi thu nhập gần bằng 0 — và bảng lương ra số ÂM. Đó không phải
 * một trường hợp hiếm gặp: nghỉ không lương dài ngày, nghỉ thai sản, tạm hoãn
 * hợp đồng đều rơi vào đây.
 */
export const UNPAID_DAYS_WITHOUT_INSURANCE = 14;

/**
 * Một bậc của biểu thuế lũy tiến.
 *
 * `quickDeduction` là "số khấu trừ nhanh": thuế = TNTT × rate − quickDeduction.
 * Nó KHÔNG phải một con số tuỳ ý mà là phần thuế đã tính dư khi áp thuế suất
 * bậc này cho cả phần thu nhập thuộc các bậc thấp hơn. Lưu sẵn thay vì cộng dồn
 * từng bậc chỉ để công thức khớp mặt chữ với bảng trong luật, dễ đối chiếu.
 */
export interface TaxBracket {
  /** Trần thu nhập tính thuế của bậc; `null` = bậc cao nhất, không có trần. */
  upTo: number | null;
  rate: number;
  quickDeduction: number;
}

/**
 * Biểu thuế lũy tiến 5 BẬC từ 01/01/2026 (Luật 109/2025/QH15).
 *
 * Rút gọn từ 7 bậc cũ và nới rộng các ngưỡng. Bậc 1 cũ chỉ tới 5 triệu, bậc 1
 * mới tới 10 triệu — dùng nhầm bảng cũ sẽ tính thừa thuế cho gần như mọi người.
 */
export const PIT_BRACKETS_2026: readonly TaxBracket[] = [
  { upTo: 10_000_000, rate: 0.05, quickDeduction: 0 },
  { upTo: 30_000_000, rate: 0.1, quickDeduction: 500_000 },
  { upTo: 60_000_000, rate: 0.2, quickDeduction: 3_500_000 },
  { upTo: 100_000_000, rate: 0.3, quickDeduction: 9_500_000 },
  { upTo: null, rate: 0.35, quickDeduction: 14_500_000 },
];

/** Giảm trừ gia cảnh từ 01/01/2026 (NQ 110/2025/UBTVQH15). */
export const SELF_DEDUCTION_2026 = 15_500_000;
export const DEPENDENT_DEDUCTION_2026 = 6_200_000;

/**
 * Năm đầu tiên module lương phục vụ.
 *
 * Trước mốc này biểu thuế là 7 bậc và giảm trừ là 11tr/4,4tr — hệ thống không
 * cài bộ số đó, nên tính lương cho kỳ trước 2026 sẽ ra số SAI chứ không phải
 * thiếu tính năng. Chặn thẳng ở `payrollConstantsFor` thay vì để nó chạy êm.
 */
export const FIRST_SUPPORTED_PAYROLL_YEAR = 2026;

export interface PayrollConstants {
  /** Mức tham chiếu của kỳ lương. */
  referenceSalary: number;
  /** Trần lương đóng BHXH/BHYT = 20 × mức tham chiếu. */
  socialInsuranceCap: number;
  selfDeduction: number;
  dependentDeduction: number;
  taxBrackets: readonly TaxBracket[];
}

/**
 * Bộ hằng số áp dụng cho kỳ lương `year`/`month`.
 *
 * Mốc chuyển mức tham chiếu là 01/07/2026, và nó được xác định theo KỲ LƯƠNG chứ
 * không theo ngày chạy bảng lương: tính lại tháng 5 vào tháng 12 vẫn phải ra con
 * số của tháng 5.
 */
export function payrollConstantsFor(
  year: number,
  month: number,
): PayrollConstants {
  if (year < FIRST_SUPPORTED_PAYROLL_YEAR) {
    throw new RangeError(
      `Payroll before ${FIRST_SUPPORTED_PAYROLL_YEAR} is not supported: the 7-bracket tax table and the old personal deductions are not configured`,
    );
  }

  const referenceSalary =
    year > 2026 || (year === 2026 && month >= 7)
      ? REFERENCE_SALARY_FROM_2026_07
      : REFERENCE_SALARY_BEFORE_2026_07;

  return {
    referenceSalary,
    socialInsuranceCap: referenceSalary * INSURANCE_CAP_MULTIPLIER,
    selfDeduction: SELF_DEDUCTION_2026,
    dependentDeduction: DEPENDENT_DEDUCTION_2026,
    taxBrackets: PIT_BRACKETS_2026,
  };
}
