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
import { LeaveRequest } from '../../leaves/entities/leave-request.entity';

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EARLY_LEAVE = 'early_leave',
  LEAVE = 'leave',
  HOLIDAY = 'holiday',
  WFH = 'wfh',
}

@Entity('attendances')
@Unique('uq_attendance_employee_date', ['employeeId', 'workDate'])
export class Attendance {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ name: 'check_in', type: 'time', nullable: true })
  checkIn: string | null;

  @Column({ name: 'check_out', type: 'time', nullable: true })
  checkOut: string | null;

  /**
   * Giờ nghỉ THỰC TẾ trong ngày, nếu nền tảng chấm công ngoài có ghi.
   *
   * `null` = bản ghi không có giờ nghỉ, khi đó giờ công được trừ theo khung
   * nghỉ chuẩn của công ty.
   */
  @Column({ name: 'break_start', type: 'time', nullable: true })
  breakStart: string | null;

  @Column({ name: 'break_end', type: 'time', nullable: true })
  breakEnd: string | null;

  @Column({
    name: 'work_hours',
    type: 'decimal',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  workHours: string | null;

  @Column({
    name: 'overtime_hours',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: 0,
  })
  overtimeHours: string;

  @Column({ name: 'is_late', type: 'boolean', default: false })
  isLate: boolean;

  @Column({ name: 'late_minutes', type: 'smallint', default: 0 })
  lateMinutes: number;

  @Column({ name: 'is_early_leave', type: 'boolean', default: false })
  isEarlyLeave: boolean;

  @Column({ name: 'early_leave_minutes', type: 'smallint', default: 0 })
  earlyLeaveMinutes: number;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  @Column({
    name: 'leave_request_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  leaveRequestId: number | null;

  @ManyToOne(() => LeaveRequest, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'leave_request_id' })
  leaveRequest: LeaveRequest | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
