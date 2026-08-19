import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalaryStatus } from '../entities/salary.entity';

/**
 * Một dòng bảng lương trả về cho client.
 *
 * TIỀN LÀ `number`, KHÔNG PHẢI CHUỖI. TypeORM trả `DECIMAL` dưới dạng chuỗi để
 * khỏi mất chính xác; giữ nguyên chuỗi ra tới client thì mọi phép cộng ở giao
 * diện đều là nối chuỗi. Tiền Việt tính đến ĐỒNG nên `number` của JavaScript
 * (an toàn tới 2^53) thừa sức chứa.
 */
export class SalaryEmployeeDto {
  @ApiProperty({ example: 51 })
  id: number;

  @ApiProperty({ example: 'NV0051' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Văn Bình' })
  fullName: string;

  @ApiPropertyOptional({ example: 'Phòng Kỹ thuật' })
  departmentName: string | null;

  @ApiPropertyOptional({ example: 'Kỹ sư phần mềm' })
  positionName: string | null;
}

export class SalaryResponseDto {
  @ApiProperty({ example: 120 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ type: SalaryEmployeeDto })
  employee: SalaryEmployeeDto;

  @ApiProperty({ example: 8 })
  month: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 21 })
  standardWorkingDays: number;

  @ApiProperty({ example: 19 })
  actualWorkingDays: number;

  @ApiProperty({ example: 2 })
  paidLeaveDays: number;

  @ApiProperty({ example: 0 })
  unpaidLeaveDays: number;

  @ApiProperty({ example: 6.5 })
  overtimeHours: number;

  @ApiProperty({ example: 20000000 })
  baseSalary: number;

  @ApiProperty({ example: 2000000 })
  positionAllowance: number;

  @ApiProperty({ example: 0 })
  attendanceAllowance: number;

  @ApiProperty({ example: 730000 })
  mealAllowance: number;

  @ApiProperty({ example: 500000 })
  transportAllowance: number;

  @ApiProperty({ example: 300000 })
  phoneAllowance: number;

  @ApiProperty({ example: 0 })
  otherAllowances: number;

  @ApiProperty({ example: 1218750 })
  overtimePay: number;

  @ApiProperty({ example: 0 })
  performanceBonus: number;

  @ApiProperty({ example: 0 })
  otherIncome: number;

  @ApiProperty({ example: 23530000 })
  grossSalary: number;

  @ApiProperty({ example: 20000000 })
  insuranceBaseSalary: number;

  @ApiProperty({ example: 1600000 })
  socialInsurance: number;

  @ApiProperty({ example: 300000 })
  healthInsurance: number;

  @ApiProperty({ example: 200000 })
  unemploymentInsurance: number;

  @ApiProperty({ example: 2100000 })
  totalInsurance: number;

  @ApiProperty({ example: 1 })
  dependentCount: number;

  @ApiProperty({ example: 15500000 })
  selfDeduction: number;

  @ApiProperty({ example: 6200000 })
  dependentDeduction: number;

  @ApiProperty({ example: 0 })
  taxableIncome: number;

  @ApiProperty({ example: 0 })
  personalIncomeTax: number;

  @ApiProperty({ example: 0 })
  advanceDeduction: number;

  @ApiProperty({ example: 0 })
  otherDeductions: number;

  @ApiProperty({ example: 21430000 })
  netSalary: number;

  @ApiProperty({ enum: SalaryStatus })
  status: SalaryStatus;

  @ApiPropertyOptional({ example: 'Thưởng dự án Q3' })
  note: string | null;

  @ApiPropertyOptional({ example: '2026-09-05T02:00:00.000Z' })
  approvedAt: string | null;

  @ApiPropertyOptional({ example: '2026-09-10T02:00:00.000Z' })
  paidAt: string | null;
}

/** Thẻ số liệu đầu trang `/payroll` — tổng của cả kỳ. */
export class PayrollPeriodSummaryDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 8 })
  month: number;

  @ApiProperty({ example: 66 })
  headcount: number;

  @ApiProperty({ example: 1_400_000_000 })
  totalGross: number;

  @ApiProperty({ example: 1_200_000_000 })
  totalNet: number;

  @ApiProperty({ example: 140_000_000 })
  totalInsurance: number;

  @ApiProperty({ example: 60_000_000 })
  totalTax: number;

  @ApiProperty({
    example: { calculated: 60, approved: 6 },
    description: 'Số dòng theo từng trạng thái.',
  })
  byStatus: Record<string, number>;
}
