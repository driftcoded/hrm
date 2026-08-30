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
 * Reads + decrypts the current SMTP configuration from the DB. Returns
 * `null` when the admin has NOT configured it completely (missing
 * host/port/fromEmail) — the caller (real transport vs. the "send test"
 * button) decides which error message fits its context.
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
