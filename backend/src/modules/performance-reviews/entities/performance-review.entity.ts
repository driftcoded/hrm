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

export enum ReviewPeriod {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  BIANNUAL = 'biannual',
  ANNUAL = 'annual',
}

export enum ReviewRating {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  AVERAGE = 'average',
  BELOW_AVERAGE = 'below_average',
  POOR = 'poor',
}

export enum ReviewStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ACKNOWLEDGED = 'acknowledged',
}

@Entity('performance_reviews')
export class PerformanceReview {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'reviewer_id', type: 'bigint', unsigned: true })
  reviewerId: number;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: Employee;

  @Column({ name: 'review_period', type: 'enum', enum: ReviewPeriod })
  reviewPeriod: ReviewPeriod;

  @Column({ name: 'period_year', type: 'smallint' })
  periodYear: number;

  @Column({ name: 'period_quarter', type: 'smallint', nullable: true })
  periodQuarter: number | null;

  @Column({ name: 'period_month', type: 'smallint', nullable: true })
  periodMonth: number | null;

  @Column({
    name: 'kpi_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  kpiScore: string | null;

  @Column({
    name: 'attitude_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  attitudeScore: string | null;

  @Column({
    name: 'skill_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  skillScore: string | null;

  @Column({
    name: 'overall_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  overallScore: string | null;

  @Column({ type: 'enum', enum: ReviewRating, nullable: true })
  rating: ReviewRating | null;

  @Column({ type: 'text', nullable: true })
  strengths: string | null;

  @Column({ type: 'text', nullable: true })
  weaknesses: string | null;

  @Column({ type: 'text', nullable: true })
  recommendations: string | null;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.DRAFT })
  status: ReviewStatus;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
