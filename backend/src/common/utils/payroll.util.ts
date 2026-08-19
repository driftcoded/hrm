import {
  EMPLOYEE_INSURANCE_RATES,
  INSURANCE_CAP_MULTIPLIER,
  MinimumWageRegion,
  REGION_MINIMUM_WAGE,
  TAX_EXEMPT_MEAL_ALLOWANCE,
  UNPAID_DAYS_WITHOUT_INSURANCE,
  payrollConstantsFor,
} from '@/common/constants/payroll.constant';

/**
 * Tính lương Net từ Gross (business-rules.md §2, §3, §4, §5, §6).
 *
 * HÀM THUẦN. Không đọc DB, không đọc đồng hồ, không biết TypeORM. Ngày lễ và số
 * người phụ thuộc được TRUYỀN VÀO. Đây là chỗ duy nhất trong hệ thống biết cách
 * ra một con số tiền lương, nên nó phải kiểm chứng được bằng một bài test chạy
 * trong 5ms chứ không phải bằng cách dựng database rồi so mắt.
 *
 * TIỀN LÀM TRÒN ĐẾN ĐỒNG, ở từng khoản một chứ không phải chỉ ở kết quả cuối.
 * Bảng lương in ra phải cộng đúng: nếu giữ số lẻ trong ruột rồi mới làm tròn
 * `net`, người đọc cộng tay các dòng sẽ ra lệch vài đồng và không ai giải thích
 * được lệch từ đâu.
 */

/** Làm tròn về đồng. `Math.round` để nửa đồng đi lên, không bào mòn về 0. */
export function roundVnd(amount: number): number {
  return Math.round(amount);
}

// ------------------------------------------------------------ ngày công ----

/**
 * Số ngày công CHUẨN của tháng: ngày T2–T6, trừ ngày lễ (business-rules.md §11.1).
 *
 * Ngày lễ rơi vào cuối tuần KHÔNG bị trừ hai lần — nó vốn đã không nằm trong
 * ngày làm việc.
 */
export function standardWorkingDaysInMonth(
  year: number,
  month: number,
  holidays: Set<string> = new Set(),
): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = date.getUTCDay();

    if (weekday === 0 || weekday === 6) {
      continue;
    }

    const iso = date.toISOString().slice(0, 10);

    if (!holidays.has(iso)) {
      count += 1;
    }
  }

  return count;
}

/** Lương một ngày công = lương tháng ÷ ngày công chuẩn (§2.1). */
export function dailyRate(monthlySalary: number, standardDays: number): number {
  return standardDays > 0 ? monthlySalary / standardDays : 0;
}

/** Lương một giờ = lương ngày ÷ 8 (§2.2). */
export function hourlyRate(
  monthlySalary: number,
  standardDays: number,
  hoursPerDay = 8,
): number {
  return hoursPerDay > 0
    ? dailyRate(monthlySalary, standardDays) / hoursPerDay
    : 0;
}

/**
 * Lương theo ngày công thực tế (§2.3).
 *
 * KHÔNG chặn trên ở 100%: làm đủ tháng cộng thêm ngày công ngoài kế hoạch vẫn
 * phải được trả cho phần vượt. Chặn lại sẽ âm thầm ăn bớt ngày công của người đi
 * làm bù.
 */
export function prorateByWorkedDays(
  monthlySalary: number,
  standardDays: number,
  actualDays: number,
): number {
  return roundVnd(dailyRate(monthlySalary, standardDays) * actualDays);
}

// ------------------------------------------------------------ bảo hiểm ----

export interface InsuranceInput {
  /** Lương ghi trong hợp đồng làm căn cứ đóng bảo hiểm, CHƯA áp trần. */
  insuranceSalary: number;
  region: MinimumWageRegion;
  year: number;
  month: number;
  /**
   * Số ngày làm việc trong tháng KHÔNG làm và KHÔNG hưởng lương. Từ 14 ngày trở
   * lên thì tháng đó không đóng bảo hiểm.
   */
  unpaidWorkingDays?: number;
}

export interface InsuranceResult {
  /** Lương đóng BHXH/BHYT sau khi áp trần — cột `insurance_base_salary`. */
  insuranceBase: number;
  /** Lương đóng BHTN sau khi áp trần riêng của nó. */
  unemploymentBase: number;
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  total: number;
}

/**
 * Bảo hiểm phần NGƯỜI LAO ĐỘNG đóng (§3.3).
 *
 * HAI TRẦN KHÁC NHAU, không phải một. BHXH/BHYT chặn ở 20 × mức tham chiếu;
 * BHTN chặn ở 20 × lương tối thiểu VÙNG — vùng I là 106,2 triệu, cao hơn hẳn.
 * Dùng chung một trần sẽ tính sai BHTN của mọi người lương cao.
 */
export function calculateEmployeeInsurance(
  input: InsuranceInput,
): InsuranceResult {
  /*
   * Nghỉ không lương từ 14 ngày làm việc trở lên: tháng đó KHÔNG đóng
   * (Điều 42 QĐ 595/QĐ-BHXH). Bỏ qua quy tắc này thì người nghỉ trọn tháng vẫn
   * bị trừ 10,5% trên lương hợp đồng trong khi gần như không có thu nhập, và
   * bảng lương ra số âm.
   */
  if ((input.unpaidWorkingDays ?? 0) >= UNPAID_DAYS_WITHOUT_INSURANCE) {
    return {
      insuranceBase: 0,
      unemploymentBase: 0,
      socialInsurance: 0,
      healthInsurance: 0,
      unemploymentInsurance: 0,
      total: 0,
    };
  }

  const { socialInsuranceCap } = payrollConstantsFor(input.year, input.month);
  const unemploymentCap =
    REGION_MINIMUM_WAGE[input.region] * INSURANCE_CAP_MULTIPLIER;

  const salary = Math.max(0, input.insuranceSalary);
  const insuranceBase = Math.min(salary, socialInsuranceCap);
  const unemploymentBase = Math.min(salary, unemploymentCap);

  const socialInsurance = roundVnd(
    insuranceBase * EMPLOYEE_INSURANCE_RATES.SOCIAL,
  );
  const healthInsurance = roundVnd(
    insuranceBase * EMPLOYEE_INSURANCE_RATES.HEALTH,
  );
  const unemploymentInsurance = roundVnd(
    unemploymentBase * EMPLOYEE_INSURANCE_RATES.UNEMPLOYMENT,
  );

  return {
    insuranceBase,
    unemploymentBase,
    socialInsurance,
    healthInsurance,
    unemploymentInsurance,
    total: socialInsurance + healthInsurance + unemploymentInsurance,
  };
}

// ---------------------------------------------------------------- thuế ----

/**
 * Thuế TNCN theo biểu lũy tiến của kỳ lương (§4.1).
 *
 * TNTT âm trả về 0 và KHÔNG hoàn thuế — thuế khấu trừ tại nguồn hàng tháng
 * không có chiều ngược lại; phần nộp thừa cả năm giải quyết ở quyết toán.
 */
export function calculatePersonalIncomeTax(
  taxableIncome: number,
  year: number,
  month: number,
): number {
  if (taxableIncome <= 0) {
    return 0;
  }

  const { taxBrackets } = payrollConstantsFor(year, month);

  const bracket =
    taxBrackets.find(
      (candidate) => candidate.upTo !== null && taxableIncome <= candidate.upTo,
    ) ?? taxBrackets[taxBrackets.length - 1];

  return roundVnd(
    Math.max(0, taxableIncome * bracket.rate - bracket.quickDeduction),
  );
}

// ------------------------------------------------------------- tổng hợp ----

export interface NetSalaryInput {
  year: number;
  month: number;

  /** Các khoản cấu thành Gross. */
  baseSalary: number;
  positionAllowance?: number;
  attendanceAllowance?: number;
  mealAllowance?: number;
  transportAllowance?: number;
  phoneAllowance?: number;
  otherAllowances?: number;
  overtimePay?: number;
  performanceBonus?: number;
  otherIncome?: number;

  /** Lương ghi trong hợp đồng làm căn cứ đóng bảo hiểm (chưa áp trần). */
  insuranceSalary: number;
  region: MinimumWageRegion;

  dependentCount?: number;

  /**
   * Ngày làm việc không làm và không hưởng lương trong tháng — từ 14 ngày trở
   * lên thì miễn đóng bảo hiểm.
   */
  unpaidWorkingDays?: number;

  /**
   * Bảo hiểm ĐÃ CHỐT của kỳ, dùng thay cho việc tính lại.
   *
   * Cần cho đường TÍNH LẠI SAU KHI CHỈNH TAY: bảng lương chỉ lưu lương đóng bảo
   * hiểm ĐÃ ÁP TRẦN, không lưu lương hợp đồng gốc. Tính lại từ con số đã áp trần
   * sẽ ra BHTN sai — trần BHTN theo lương tối thiểu vùng cao hơn trần BHXH, nên
   * lấy nhầm đầu vào là trừ hụt. Mà thưởng thêm cũng không làm đổi tiền bảo
   * hiểm: nó tính trên lương hợp đồng, không tính trên thu nhập thực tế.
   */
  insuranceOverride?: {
    insuranceBase: number;
    socialInsurance: number;
    healthInsurance: number;
    unemploymentInsurance: number;
    total: number;
  };

  /** Trừ sau thuế. */
  advanceDeduction?: number;
  otherDeductions?: number;
}

export interface NetSalaryResult {
  grossSalary: number;

  insuranceBaseSalary: number;
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  totalInsurance: number;

  /** Phần phụ cấp được miễn thuế TNCN — đã trừ khỏi thu nhập chịu thuế. */
  taxExemptAllowance: number;
  /** Gross − phần miễn thuế (§6 bước 4). */
  assessableIncome: number;

  selfDeduction: number;
  dependentDeduction: number;
  /** Thu nhập TÍNH thuế sau bảo hiểm và giảm trừ, sàn 0 (§6 bước 6). */
  taxableIncome: number;
  personalIncomeTax: number;

  netSalary: number;
}

/**
 * Toàn bộ 8 bước của §6, theo đúng thứ tự.
 *
 * ĐẢO THỨ TỰ LÀ RA SỐ KHÁC. Bảo hiểm trừ vào thu nhập TÍNH thuế chứ không trừ
 * vào thu nhập CHỊU thuế; giảm trừ gia cảnh đứng sau bảo hiểm. Trừ nhầm chỗ
 * không làm sai lệch chút ít mà đổi hẳn bậc thuế.
 *
 * `advanceDeduction` và `otherDeductions` trừ SAU thuế: tạm ứng là tiền đã trả
 * trước, không phải một khoản chi phí làm giảm thu nhập chịu thuế.
 */
export function calculateNetSalary(input: NetSalaryInput): NetSalaryResult {
  const { selfDeduction, dependentDeduction } = payrollConstantsFor(
    input.year,
    input.month,
  );

  const mealAllowance = input.mealAllowance ?? 0;
  const transportAllowance = input.transportAllowance ?? 0;
  const phoneAllowance = input.phoneAllowance ?? 0;

  const grossSalary = roundVnd(
    input.baseSalary +
      (input.positionAllowance ?? 0) +
      (input.attendanceAllowance ?? 0) +
      mealAllowance +
      transportAllowance +
      phoneAllowance +
      (input.otherAllowances ?? 0) +
      (input.overtimePay ?? 0) +
      (input.performanceBonus ?? 0) +
      (input.otherIncome ?? 0),
  );

  const insurance =
    input.insuranceOverride ??
    calculateEmployeeInsurance({
      insuranceSalary: input.insuranceSalary,
      region: input.region,
      year: input.year,
      month: input.month,
      unpaidWorkingDays: input.unpaidWorkingDays,
    });

  /*
   * Bữa ăn giữa ca chỉ miễn thuế tới 730.000; phần VƯỢT vẫn chịu thuế. Miễn cả
   * khoản là cách một công ty trả 5 triệu "tiền ăn" để né thuế.
   */
  const taxExemptAllowance = roundVnd(
    Math.min(mealAllowance, TAX_EXEMPT_MEAL_ALLOWANCE) +
      transportAllowance +
      phoneAllowance,
  );

  const assessableIncome = grossSalary - taxExemptAllowance;
  const totalDependentDeduction =
    dependentDeduction * (input.dependentCount ?? 0);

  const taxableIncome = Math.max(
    0,
    assessableIncome -
      insurance.total -
      selfDeduction -
      totalDependentDeduction,
  );

  const personalIncomeTax = calculatePersonalIncomeTax(
    taxableIncome,
    input.year,
    input.month,
  );

  const netSalary = roundVnd(
    grossSalary -
      insurance.total -
      personalIncomeTax -
      (input.advanceDeduction ?? 0) -
      (input.otherDeductions ?? 0),
  );

  return {
    grossSalary,
    insuranceBaseSalary: insurance.insuranceBase,
    socialInsurance: insurance.socialInsurance,
    healthInsurance: insurance.healthInsurance,
    unemploymentInsurance: insurance.unemploymentInsurance,
    totalInsurance: insurance.total,
    taxExemptAllowance,
    assessableIncome,
    selfDeduction,
    dependentDeduction: totalDependentDeduction,
    taxableIncome,
    personalIncomeTax,
    netSalary,
  };
}
