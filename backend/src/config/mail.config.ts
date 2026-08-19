import { registerAs } from '@nestjs/config';

/**
 * `dev`  – render email ra file HTML trong `logs/mail/` (mặc định môi trường dev).
 * `smtp` – gửi thật qua SMTP; host/port/user/password đọc từ `system_mail_settings`
 *          (DB, cấu hình qua `/settings/mail` bởi admin), KHÔNG phải từ env.
 */
export type MailTransportKind = 'dev' | 'smtp';

export interface MailConfig {
  transport: MailTransportKind;
  from: string;
  fromName: string;
  /** Thư mục ghi email khi transport = dev. */
  devOutputDir: string;
}

export const mailConfig = registerAs('mail', (): MailConfig => {
  const transport = (process.env.MAIL_TRANSPORT ?? 'dev') as MailTransportKind;

  return {
    transport: transport === 'smtp' ? 'smtp' : 'dev',
    from: process.env.MAIL_FROM ?? 'no-reply@company.local',
    fromName: process.env.MAIL_FROM_NAME ?? 'HRM System',
    devOutputDir: process.env.MAIL_DEV_OUTPUT_DIR ?? 'logs/mail',
  };
});
