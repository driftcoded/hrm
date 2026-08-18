import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { Department } from '../../departments/entities/department.entity';
import { Position } from '../../positions/entities/position.entity';
import { User } from '../../users/entities/user.entity';

export enum WorkHistoryEventType {
  HIRE = 'hire',
  PROMOTION = 'promotion',
  DEMOTION = 'demotion',
  TRANSFER = 'transfer',
  SALARY_CHANGE = 'salary_change',
  CONTRACT_RENEW = 'contract_renew',
  RETURN_FROM_LEAVE = 'return_from_leave',
  TERMINATION = 'termination',
}

/** Lịch sử công tác – chỉ INSERT, không UPDATE. */
@Entity('work_history')
export class WorkHistory {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'event_type', type: 'enum', enum: WorkHistoryEventType })
  eventType: WorkHistoryEventType;

  @Column({
    name: 'from_department_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  fromDepartmentId: number | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'from_department_id' })
  fromDepartment: Department | null;

  @Column({
    name: 'to_department_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  toDepartmentId: number | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'to_department_id' })
  toDepartment: Department | null;

  @Column({
    name: 'from_position_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  fromPositionId: number | null;

  @ManyToOne(() => Position, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'from_position_id' })
  fromPosition: Position | null;

  @Column({
    name: 'to_position_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  toPositionId: number | null;

  @ManyToOne(() => Position, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'to_position_id' })
  toPosition: Position | null;

  @Column({
    name: 'from_salary',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  fromSalary: string | null;

  @Column({
    name: 'to_salary',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  toSalary: string | null;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({
    name: 'decision_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  decisionNumber: string | null;

  @Column({
    name: 'document_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  documentUrl: string | null;

  @Column({
    name: 'created_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  createdBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
