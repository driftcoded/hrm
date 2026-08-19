import { registerAs } from '@nestjs/config';

export interface SettingsConfig {
  /** 32-byte AES-256 key (64 hex chars) for `system_mail_settings.smtp_password_encrypted`. */
  encryptionKey: string;
}

export const settingsConfig = registerAs('settings', (): SettingsConfig => ({
  encryptionKey: process.env.SETTINGS_ENCRYPTION_KEY ?? '',
}));
