/**
 * Kiểu dữ liệu phân hệ LƯƠNG (PLAN giai đoạn 6).
 *
 * MỌI SỐ TIỀN LÀ `number`. Backend đã đổi `DECIMAL` sang số ở biên; giữ chuỗi ra
 * tới đây thì mọi phép cộng ở giao diện đều là nối chuỗi.
 */

export const SALARY_STATUSES = [
  'draft',
  'calculated',
  'approved',
  'paid',
  'cancelled',
] as const;

export type SalaryStatus = (typeof SALARY_STATUSES)[number];

export const SALARY_ADVANCE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'deducted',
  'cancelled',
] as const;

export type SalaryAdvanceStatus = (typeof SALARY_ADVANCE_STATUSES)[number];

export interface SalaryEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  positionName: string | null;
}

export interface Salary {
  id: number;
  employeeId: number;
  employee: SalaryEmployee;
  month: number;
  year: number;

  standardWorkingDays: number;
  actualWorkingDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  overtimeHours: number;

  baseSalary: number;
  positionAllowance: number;
  attendanceAllowance: number;
  mealAllowance: number;
  transportAllowance: number;
  phoneAllowance: number;
  otherAllowances: number;
  overtimePay: number;
  performanceBonus: number;
  otherIncome: number;
  grossSalary: number;

  insuranceBaseSalary: number;
  socialInsurance: number;
  healthInsurance: number;
  unemploymentInsurance: number;
  totalInsurance: number;

  dependentCount: number;
  selfDeduction: number;
  dependentDeduction: number;
  taxableIncome: number;
  personalIncomeTax: number;

  advanceDeduction: number;
  otherDeductions: number;
  netSalary: number;

  status: SalaryStatus;
  note: string | null;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface SalaryFilters {
  page?: number;
  limit?: number;
  sort?: 'employeeCode' | 'netSalary' | 'grossSalary';
  order?: 'asc' | 'desc';
  /** BẮT BUỘC — bảng lương là số liệu của một kỳ. */
  year: number;
  month?: number;
  employeeId?: number;
  departmentId?: number;
  status?: SalaryStatus;
}

/** Thẻ số liệu đầu trang — tổng của cả kỳ. */
export interface PayrollPeriodSummary {
  year: number;
  month: number;
  headcount: number;
  totalGross: number;
  totalNet: number;
  totalInsurance: number;
  totalTax: number;
  byStatus: Partial<Record<SalaryStatus, number>>;
}

export interface PayrollPeriod {
  year: number;
  month: number;
}

export interface CalculatePayrollPayload {
  year: number;
  month: number;
  dryRun?: boolean;
}

/**
 * Kết quả một lần chạy tính lương.
 *
 * `skippedLocked` và `skippedNoContract` là hai lý do KHÁC NHAU khiến một người
 * không có dòng lương, và người bấm cần phân biệt được: một bên là đã chốt nên
 * cố ý bỏ qua, bên kia là thiếu dữ liệu và phải đi sửa.
 */
export interface PayrollRunResult {
  year: number;
  month: number;
  standardWorkingDays: number;
  employeesConsidered: number;
  created: number;
  updated: number;
  skippedLocked: number;
  skippedNoContract: string[];
  totalGross: number;
  totalNet: number;
  dryRun: boolean;
}

export interface UpdateSalaryPayload {
  performanceBonus?: number;
  otherIncome?: number;
  otherDeductions?: number;
  note?: string;
}

// -------------------------------------------------------- tạm ứng lương ----

export interface SalaryAdvance {
  id: number;
  employeeId: number;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
    departmentName: string | null;
  };
  amount: number;
  advanceDate: string;
  /** KỲ LƯƠNG bị trừ — tách khỏi `advanceDate` là ngày thực chi. */
  deductMonth: number;
  deductYear: number;
  reason: string;
  status: SalaryAdvanceStatus;
  rejectedReason: string | null;
  recordedBy: number | null;
  recorderName: string | null;
  approverName: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface SalaryAdvanceFilters {
  page?: number;
  limit?: number;
  employeeId?: number;
  status?: SalaryAdvanceStatus;
  deductYear?: number;
  deductMonth?: number;
}

export interface CreateSalaryAdvancePayload {
  employeeId: number;
  amount: number;
  advanceDate: string;
  deductMonth: number;
  deductYear: number;
  reason: string;
}

// -------------------------------------------------------- cấu hình lương ----

export interface PayrollSettings {
  /** 1–4. Quyết định TRẦN đóng BHTN (20 × lương tối thiểu vùng). */
  minimumWageRegion: number;
  mealAllowance: number;
  transportAllowance: number;
  phoneAllowance: number;
  attendanceAllowance: number;
  payOvertime: boolean;
  updatedAt: string;
}

export type UpdatePayrollSettingsPayload = Partial<
  Omit<PayrollSettings, 'updatedAt'>
>;
