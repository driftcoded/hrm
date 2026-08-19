import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum LeaveApplicableGender {
  ALL = 'all',
  FEMALE = 'female',
  MALE = 'male',
}

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn('increment', { type: 'tinyint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    name: 'days_per_year',
    type: 'decimal',
    precision: 5,
    scale: 1,
  })
  daysPerYear: string;

  @Column({ name: 'is_paid', type: 'boolean', default: true })
  isPaid: boolean;

  @Column({ name: 'require_approval', type: 'boolean', default: true })
  requireApproval: boolean;

  @Column({
    name: 'min_days',
    type: 'decimal',
    precision: 4,
    scale: 1,
    default: 0.5,
  })
  minDays: string;

  @Column({ name: 'max_consecutive', type: 'smallint', nullable: true })
  maxConsecutive: number | null;

  @Column({ name: 'advance_notice_days', type: 'smallint', default: 1 })
  advanceNoticeDays: number;

  @Column({
    name: 'applicable_gender',
    type: 'enum',
    enum: LeaveApplicableGender,
    default: LeaveApplicableGender.ALL,
  })
  applicableGender: LeaveApplicableGender;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  /**
   * Statutory row seeded from Vietnamese labor law. INFORMATIONAL ONLY — it
   * enforces nothing: HR can edit and delete these rows, because legislation
   * changes (entitlements are raised, statutory types get repealed). The only
   * delete guard is LEAVE_TYPE_IN_USE, in LeaveTypesService.remove().
   */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;
}
