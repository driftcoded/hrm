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

export enum AnnouncementType {
  GENERAL = 'general',
  POLICY = 'policy',
  EVENT = 'event',
  URGENT = 'urgent',
}

export enum AnnouncementTargetAudience {
  ALL = 'all',
  DEPARTMENT = 'department',
  ROLE = 'role',
  INDIVIDUAL = 'individual',
}

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: AnnouncementType,
    default: AnnouncementType.GENERAL,
  })
  type: AnnouncementType;

  @Column({
    name: 'target_audience',
    type: 'enum',
    enum: AnnouncementTargetAudience,
    default: AnnouncementTargetAudience.ALL,
  })
  targetAudience: AnnouncementTargetAudience;

  /** Danh sách ID đối tượng nhận, ví dụ: [1, 2, 3]. NULL khi target_audience = all */
  @Column({ name: 'target_ids', type: 'json', nullable: true })
  targetIds: number[] | null;

  @Column({ name: 'publish_date', type: 'timestamp', nullable: true })
  publishDate: Date | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  expiryDate: Date | null;

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned: boolean;

  @Column({
    name: 'attachment_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  attachmentUrl: string | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true })
  createdBy: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
