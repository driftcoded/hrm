import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

export enum SalaryAdvanceStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  /** Đã bị trừ vào một bảng lương — từ đây là chứng từ, không sửa được nữa. */
  DEDUCTED = 'deducted',
  CANCELLED = 'cancelled',
}

/**
 * Tạm ứng lương (PLAN 6.1).
 *
 * NGÀY ỨNG TIỀN TÁCH KHỎI KỲ LƯƠNG BỊ TRỪ. Ứng ngày 28/07 để trừ vào lương
 * tháng 8 là chuyện bình thường; suy kỳ trừ từ ngày ứng sẽ đoán sai đúng những
 * trường hợp đó, và đoán sai ở đây nghĩa là trừ hai lần hoặc không trừ lần nào.
 *
 * Cùng khuôn với đơn nghỉ phép: quản lý/nhân sự GHI NHẬN (`recorded_by`), nhân
 * sự DUYỆT, và người đã ghi không duyệt được chính phiếu đó — nhân viên không
 * đăng nhập hệ thống này nên không ai tự đề nghị.
 */
@Entity('salary_advances')
export class SalaryAdvance {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: string;

  /** Ngày thực chi tiền cho nhân viên. */
  @Column({ name: 'advance_date', type: 'date' })
  advanceDate: string;

  /** Kỳ lương sẽ bị trừ khoản này. */
  @Column({ name: 'deduct_month', type: 'smallint' })
  deductMonth: number;

  @Column({ name: 'deduct_year', type: 'smallint' })
  deductYear: number;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @Column({
    type: 'enum',
    enum: SalaryAdvanceStatus,
    default: SalaryAdvanceStatus.PENDING,
  })
  status: SalaryAdvanceStatus;

  @Column({ name: 'rejected_reason', type: 'text', nullable: true })
  rejectedReason: string | null;

  @Column({
    name: 'recorded_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  recordedBy: number | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recorded_by' })
  recorder: Employee | null;

  @Column({
    name: 'approved_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  approvedBy: number | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approved_by' })
  approver: Employee | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
