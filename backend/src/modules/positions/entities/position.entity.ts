import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'department_id', type: 'bigint', unsigned: true })
  departmentId: number;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  /** Level: 1 Staff, 2 Senior, 3 Lead, 4 Manager, 5 Director */
  @Column({ type: 'smallint' })
  level: number;

  @Column({
    name: 'min_salary',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  minSalary: string | null;

  @Column({
    name: 'max_salary',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  maxSalary: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
