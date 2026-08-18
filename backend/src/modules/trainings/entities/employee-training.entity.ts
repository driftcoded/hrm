import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { Training } from './training.entity';

export enum TrainingResult {
  PASSED = 'passed',
  FAILED = 'failed',
  INCOMPLETE = 'incomplete',
  EXEMPTED = 'exempted',
}

/** Bảng trung gian many-to-many employees <-> trainings, kèm kết quả. */
@Entity('employee_trainings')
@Unique('uq_employee_training', ['employeeId', 'trainingId'])
export class EmployeeTraining {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'training_id', type: 'bigint', unsigned: true })
  trainingId: number;

  @ManyToOne(() => Training, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'training_id' })
  training: Training;

  @Column({ name: 'registration_date', type: 'date' })
  registrationDate: string;

  @Column({ name: 'completion_date', type: 'date', nullable: true })
  completionDate: string | null;

  @Column({ type: 'enum', enum: TrainingResult, nullable: true })
  result: TrainingResult | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  score: string | null;

  @Column({
    name: 'certificate_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  certificateUrl: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
