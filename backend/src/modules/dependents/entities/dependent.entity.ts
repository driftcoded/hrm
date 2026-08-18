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

export enum DependentRelationship {
  CHILD = 'child',
  SPOUSE = 'spouse',
  PARENT = 'parent',
  SIBLING = 'sibling',
  OTHER = 'other',
}

export enum DependentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

/** Dependent — personal income tax family circumstance deduction (Article 19, Law on Personal Income Tax). */
@Entity('dependents')
export class Dependent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ type: 'enum', enum: DependentRelationship })
  relationship: DependentRelationship;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: string;

  @Column({
    name: 'cccd_number',
    type: 'varchar',
    length: 12,
    nullable: true,
  })
  cccdNumber: string | null;

  @Column({ name: 'tax_code', type: 'varchar', length: 13, nullable: true })
  taxCode: string | null;

  @Column({ name: 'registration_date', type: 'date' })
  registrationDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({
    type: 'enum',
    enum: DependentStatus,
    default: DependentStatus.ACTIVE,
  })
  status: DependentStatus;

  @Column({
    name: 'reason_inactive',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  reasonInactive: string | null;

  @Column({
    name: 'document_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  documentUrl: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
