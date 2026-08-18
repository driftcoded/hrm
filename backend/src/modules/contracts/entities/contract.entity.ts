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
import { User } from '../../users/entities/user.entity';

export enum ContractType {
  PROBATION = 'probation',
  FIXED_TERM = 'fixed_term',
  INDEFINITE = 'indefinite',
  SEASONAL = 'seasonal',
}

export enum ContractStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
}

/** Labor contract (Article 20, Labor Code 2019). */
@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({
    name: 'contract_number',
    type: 'varchar',
    length: 50,
    unique: true,
  })
  contractNumber: string;

  @Column({ name: 'contract_type', type: 'enum', enum: ContractType })
  contractType: ContractType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'sign_date', type: 'date' })
  signDate: string;

  @Column({ name: 'base_salary', type: 'decimal', precision: 15, scale: 2 })
  baseSalary: string;

  @Column({
    name: 'insurance_salary',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  insuranceSalary: string;

  @Column({
    name: 'position_allowance',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  positionAllowance: string;

  @Column({
    name: 'other_allowance',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  otherAllowance: string;

  @Column({
    name: 'working_hours',
    type: 'decimal',
    precision: 4,
    scale: 2,
    default: 8.0,
  })
  workingHours: string;

  @Column({ name: 'working_days', type: 'smallint', default: 5 })
  workingDays: number;

  @Column({
    name: 'probation_salary_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 85.0,
  })
  probationSalaryPct: string | null;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.DRAFT,
  })
  status: ContractStatus;

  @Column({ name: 'terminated_date', type: 'date', nullable: true })
  terminatedDate: string | null;

  @Column({ name: 'terminated_reason', type: 'text', nullable: true })
  terminatedReason: string | null;

  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

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

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
