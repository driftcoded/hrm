import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TrainingType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  ONLINE = 'online',
  ON_THE_JOB = 'on_the_job',
}

export enum TrainingStatus {
  PLANNED = 'planned',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('trainings')
export class Training {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'enum', enum: TrainingType })
  type: TrainingType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  trainer: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  cost: string;

  @Column({ name: 'max_participants', type: 'smallint', nullable: true })
  maxParticipants: number | null;

  @Column({
    type: 'enum',
    enum: TrainingStatus,
    default: TrainingStatus.PLANNED,
  })
  status: TrainingStatus;

  @Column({
    name: 'attachment_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  attachmentUrl: string | null;

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
