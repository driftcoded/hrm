import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Cấu hình thương hiệu hiển thị trên UI (tên công ty, logo, favicon).
 * CHỈ 1 DÒNG (id luôn = 1, ràng buộc CHECK ở migration) — không phải danh sách.
 */
@Entity('system_branding_settings')
export class SystemBrandingSettings {
  @PrimaryColumn({ type: 'tinyint', unsigned: true })
  id: number;

  @Column({ name: 'company_name', type: 'varchar', length: 150 })
  companyName: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({
    name: 'favicon_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  faviconUrl: string | null;

  @Column({
    name: 'updated_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  updatedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updater: User | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
