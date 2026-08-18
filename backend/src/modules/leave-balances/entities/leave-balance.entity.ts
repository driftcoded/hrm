import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { LeaveType } from '../../leaves/entities/leave-type.entity';

/**
 * Số ngày phép còn lại. `remainingDays` là cột VIRTUAL GENERATED (MySQL/MariaDB
 * generated column), tính = allocated_days + carried_over - used_days - pending_days.
 * Không lưu vật lý, không thể INSERT/UPDATE trực tiếp giá trị này.
 */
@Entity('leave_balances')
@Unique('uq_leave_balance_employee_type_year', [
  'employeeId',
  'leaveTypeId',
  'year',
])
export class LeaveBalance {
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

  @Column({ type: 'smallint' })
  year: number;

  @Column({
    name: 'allocated_days',
    type: 'decimal',
    precision: 5,
    scale: 1,
  })
  allocatedDays: string;

  @Column({
    name: 'used_days',
    type: 'decimal',
    precision: 5,
    scale: 1,
    default: 0,
  })
  usedDays: string;

  @Column({
    name: 'pending_days',
    type: 'decimal',
    precision: 5,
    scale: 1,
    default: 0,
  })
  pendingDays: string;

  @Column({
    name: 'carried_over',
    type: 'decimal',
    precision: 5,
    scale: 1,
    default: 0,
  })
  carriedOver: string;

  /**
   * VIRTUAL GENERATED COLUMN (MySQL/MariaDB) — không lưu vật lý, DB tự tính.
   * `insert`/`update` = false để TypeORM không cố gắng ghi giá trị này.
   */
  @Column({
    name: 'remaining_days',
    type: 'decimal',
    precision: 6,
    scale: 1,
    generatedType: 'VIRTUAL',
    asExpression: 'allocated_days + carried_over - used_days - pending_days',
    insert: false,
    update: false,
    select: true,
  })
  remainingDays: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
