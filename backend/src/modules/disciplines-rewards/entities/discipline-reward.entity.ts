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

export enum DisciplineRewardType {
  REWARD = 'reward',
  DISCIPLINE = 'discipline',
}

@Entity('disciplines_rewards')
export class DisciplineReward {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'enum', enum: DisciplineRewardType })
  type: DisciplineRewardType;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    name: 'decision_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  decisionNumber: string | null;

  @Column({ name: 'decision_date', type: 'date' })
  decisionDate: string;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  amount: string | null;

  @Column({
    name: 'issued_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  issuedBy: number | null;

  @ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'issued_by' })
  issuer: Employee | null;

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
