import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { User } from '../../users/entities/user.entity';

export enum SalaryStatus {
  DRAFT = 'draft',
  CALCULATED = 'calculated',
  APPROVED = 'approved',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

const money = { type: 'decimal' as const, precision: 15, scale: 2 };

@Entity('salaries')
@Unique('uq_salary_employee_month_year', ['employeeId', 'month', 'year'])
export class Salary {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'smallint' })
  month: number;

  @Column({ type: 'smallint' })
  year: number;

  // ---- Ngày công ----
  @Column({
    name: 'standard_working_days',
    type: 'decimal',
    precision: 4,
    scale: 1,
  })
  standardWorkingDays: string;

  @Column({
    name: 'actual_working_days',
    type: 'decimal',
    precision: 4,
    scale: 1,
    default: 0,
  })
  actualWorkingDays: string;

  @Column({
    name: 'paid_leave_days',
    type: 'decimal',
    precision: 4,
    scale: 1,
    default: 0,
  })
  paidLeaveDays: string;

  @Column({
    name: 'unpaid_leave_days',
    type: 'decimal',
    precision: 4,
    scale: 1,
    default: 0,
  })
  unpaidLeaveDays: string;

  @Column({
    name: 'overtime_hours',
    type: 'decimal',
    precision: 5,
    scale: 1,
    default: 0,
  })
  overtimeHours: string;

  // ---- Thu nhập ----
  @Column({ name: 'base_salary', ...money })
  baseSalary: string;

  @Column({ name: 'position_allowance', ...money, default: 0 })
  positionAllowance: string;

  @Column({ name: 'attendance_allowance', ...money, default: 0 })
  attendanceAllowance: string;

  @Column({ name: 'meal_allowance', ...money, default: 0 })
  mealAllowance: string;

  @Column({ name: 'transport_allowance', ...money, default: 0 })
  transportAllowance: string;

  @Column({ name: 'phone_allowance', ...money, default: 0 })
  phoneAllowance: string;

  @Column({ name: 'other_allowances', ...money, default: 0 })
  otherAllowances: string;

  @Column({ name: 'overtime_pay', ...money, default: 0 })
  overtimePay: string;

  @Column({ name: 'performance_bonus', ...money, default: 0 })
  performanceBonus: string;

  @Column({ name: 'other_income', ...money, default: 0 })
  otherIncome: string;

  @Column({ name: 'gross_salary', ...money })
  grossSalary: string;

  // ---- Bảo hiểm (NLĐ đóng) ----
  @Column({ name: 'insurance_base_salary', ...money })
  insuranceBaseSalary: string;

  @Column({ name: 'social_insurance', ...money, default: 0 })
  socialInsurance: string;

  @Column({ name: 'health_insurance', ...money, default: 0 })
  healthInsurance: string;

  @Column({ name: 'unemployment_insurance', ...money, default: 0 })
  unemploymentInsurance: string;

  @Column({ name: 'total_insurance', ...money, default: 0 })
  totalInsurance: string;

  // ---- Thuế TNCN ----
  @Column({ name: 'dependent_count', type: 'smallint', default: 0 })
  dependentCount: number;

  @Column({ name: 'self_deduction', ...money, default: 11000000 })
  selfDeduction: string;

  @Column({ name: 'dependent_deduction', ...money, default: 0 })
  dependentDeduction: string;

  @Column({ name: 'taxable_income', ...money, default: 0 })
  taxableIncome: string;

  @Column({ name: 'personal_income_tax', ...money, default: 0 })
  personalIncomeTax: string;

  // ---- Khấu trừ khác & Thực nhận ----
  @Column({ name: 'advance_deduction', ...money, default: 0 })
  advanceDeduction: string;

  @Column({ name: 'other_deductions', ...money, default: 0 })
  otherDeductions: string;

  @Column({ name: 'net_salary', ...money })
  netSalary: string;

  // ---- Trạng thái & Phê duyệt ----
  @Column({ type: 'enum', enum: SalaryStatus, default: SalaryStatus.DRAFT })
  status: SalaryStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    name: 'approved_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  approvedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver: User | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({
    name: 'generated_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  generatedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'generated_by' })
  generator: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
