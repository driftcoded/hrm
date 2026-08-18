import { registerAs } from '@nestjs/config';

/**
 * `dev`  – render email ra file HTML trong `logs/mail/` (mặc định môi trường dev).
 * `ses`  – gửi thật qua AWS SES (chỉ bật ở production khi đã có credentials).
 */
export type MailTransportKind = 'dev' | 'ses';

export interface MailConfig {
  transport: MailTransportKind;
  from: string;
  fromName: string;
  /** Thư mục ghi email khi transport = dev. */
  devOutputDir: string;
  /** Region SES – chỉ dùng khi transport = ses. */
  awsRegion: string;
}

export const mailConfig = registerAs('mail', (): MailConfig => {
  const transport = (process.env.MAIL_TRANSPORT ?? 'dev') as MailTransportKind;

  return {
    transport: transport === 'ses' ? 'ses' : 'dev',
    from: process.env.MAIL_FROM ?? 'no-reply@company.local',
    fromName: process.env.MAIL_FROM_NAME ?? 'HRM System',
    devOutputDir: process.env.MAIL_DEV_OUTPUT_DIR ?? 'logs/mail',
    awsRegion: process.env.AWS_REGION ?? 'ap-southeast-1',
  };
});
