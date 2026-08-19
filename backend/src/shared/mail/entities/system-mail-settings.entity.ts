import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../modules/users/entities/user.entity';

/**
 * Cấu hình SMTP dùng để gửi email thật (thay AWS SES). CHỈ 1 DÒNG (id luôn = 1,
 * ràng buộc CHECK ở migration).
 *
 * `smtpPasswordEncrypted` là ciphertext AES-256-GCM (xem
 * common/utils/encryption.util.ts + settings.config.ts) — KHÔNG BAO GIỜ giải
 * mã ở đây; entity chỉ mang dữ liệu thô, giải mã là việc của service.
 */
@Entity('system_mail_settings')
export class SystemMailSettings {
  @PrimaryColumn({ type: 'tinyint', unsigned: true })
  id: number;

  @Column({ name: 'smtp_host', type: 'varchar', length: 255, nullable: true })
  smtpHost: string | null;

  @Column({
    name: 'smtp_port',
    type: 'smallint',
    unsigned: true,
    nullable: true,
  })
  smtpPort: number | null;

  @Column({ name: 'smtp_secure', type: 'boolean', default: true })
  smtpSecure: boolean;

  @Column({
    name: 'smtp_username',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  smtpUsername: string | null;

  @Column({
    name: 'smtp_password_encrypted',
    type: 'text',
    nullable: true,
  })
  smtpPasswordEncrypted: string | null;

  @Column({
    name: 'smtp_from_email',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  smtpFromEmail: string | null;

  @Column({
    name: 'smtp_from_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  smtpFromName: string | null;

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
