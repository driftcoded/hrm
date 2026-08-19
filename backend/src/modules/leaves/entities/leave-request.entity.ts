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
import { LeaveHalf } from '../../../common/utils/leave.util';
import { LeaveType } from './leave-type.entity';

/**
 * Nửa ngày nghỉ.
 *
 * Định nghĩa nằm ở `leave.util.ts` và được XUẤT LẠI ở đây. Hai enum song song
 * cùng giá trị buộc service phải ép kiểu giữa chúng, và ngày ai đó thêm một giá
 * trị vào một bên thì phép ép kiểu đó im lặng nói dối.
 */
export { LeaveHalf } from '../../../common/utils/leave.util';

export enum LeaveRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'leave_type_id', type: 'tinyint', unsigned: true })
  leaveTypeId: number;

  @ManyToOne(() => LeaveType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType: LeaveType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({
    name: 'start_half',
    type: 'enum',
    enum: LeaveHalf,
    default: LeaveHalf.FULL,
  })
  startHalf: LeaveHalf;

  @Column({
    name: 'end_half',
    type: 'enum',
    enum: LeaveHalf,
    default: LeaveHalf.FULL,
  })
  endHalf: LeaveHalf;

  @Column({ name: 'total_days', type: 'decimal', precision: 5, scale: 1 })
  totalDays: string;

  @Column({ type: 'text' })
  reason: string;

  /**
   * `employees.id` của người GHI NHẬN đơn (quản lý / nhân sự nhập hộ).
   *
   * Nhân viên không đăng nhập hệ thống này nên `employeeId` là người ĐƯỢC nghỉ,
   * không phải người nhập. Cột này giữ nguyên tắc người ghi ≠ người duyệt —
   * xem migration `AddRecordedByToLeaveRequests`.
   */
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
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING,
  })
  status: LeaveRequestStatus;

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

  @Column({ name: 'rejected_reason', type: 'text', nullable: true })
  rejectedReason: string | null;

  @Column({
    name: 'attachment_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  attachmentUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
