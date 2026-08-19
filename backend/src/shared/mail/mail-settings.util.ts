import { decryptSecret } from '@/common/utils/encryption.util';
import { SystemMailSettings } from './entities/system-mail-settings.entity';
import { MailSettingsRepository } from './mail-settings.repository';

export interface ResolvedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  password: string | null;
  fromEmail: string;
  fromName: string;
}

/**
 * Đọc + giải mã cấu hình SMTP hiện tại từ DB. Trả `null` khi admin CHƯA cấu
 * hình đủ (thiếu host/port/fromEmail) — caller (transport thật vs. nút "gửi
 * thử") tự quyết định thông báo lỗi phù hợp ngữ cảnh.
 */
export function toResolvedSmtpConfig(
  row: SystemMailSettings,
  encryptionKey: string,
): ResolvedSmtpConfig | null {
  if (!row.smtpHost || !row.smtpPort || !row.smtpFromEmail) {
    return null;
  }

  return {
    host: row.smtpHost,
    port: row.smtpPort,
    secure: row.smtpSecure,
    username: row.smtpUsername,
    password: row.smtpPasswordEncrypted
      ? decryptSecret(row.smtpPasswordEncrypted, encryptionKey)
      : null,
    fromEmail: row.smtpFromEmail,
    fromName: row.smtpFromName ?? row.smtpFromEmail,
  };
}

export async function resolveSmtpConfig(
  repository: MailSettingsRepository,
  encryptionKey: string,
): Promise<ResolvedSmtpConfig | null> {
  return toResolvedSmtpConfig(await repository.get(), encryptionKey);
}
