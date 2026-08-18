import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Salary } from './salary.entity';

export enum SalaryComponentType {
  ALLOWANCE = 'allowance',
  BONUS = 'bonus',
  DEDUCTION = 'deduction',
  OTHER = 'other',
}

@Entity('salary_components')
export class SalaryComponent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'salary_id', type: 'bigint', unsigned: true })
  salaryId: number;

  @ManyToOne(() => Salary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'salary_id' })
  salary: Salary;

  @Column({ type: 'enum', enum: SalaryComponentType })
  type: SalaryComponentType;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: string;

  @Column({ name: 'is_taxable', type: 'boolean', default: false })
  isTaxable: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;
}
