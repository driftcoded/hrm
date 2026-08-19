import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { SettingsConfig } from '@/config/settings.config';
import {
  MailMessage,
  MailSendResult,
  MailTransport,
} from '../mail-transport.interface';
import { MailSettingsRepository } from '../mail-settings.repository';
import { resolveSmtpConfig, ResolvedSmtpConfig } from '../mail-settings.util';

/**
 * Gửi mail thật qua SMTP. Cấu hình đọc TỪ DB ở MỖI lần gửi (không cache
 * trong bộ nhớ): số lượng email của một hệ thống HR nội bộ rất thấp, không
 * đáng đánh đổi lấy nguy cơ gửi bằng cấu hình cũ sau khi admin vừa đổi mật
 * khẩu SMTP mà app chưa kịp restart.
 */
@Injectable()
export class SmtpMailTransport implements MailTransport {
  readonly kind = 'smtp' as const;

  private readonly logger = new Logger(SmtpMailTransport.name);

  constructor(
    private readonly mailSettingsRepository: MailSettingsRepository,
    private readonly configService: ConfigService,
  ) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const config = await resolveSmtpConfig(
      this.mailSettingsRepository,
      this.encryptionKey,
    );

    if (!config) {
      throw new ServiceUnavailableException({
        code: 'MAIL_TRANSPORT_UNAVAILABLE',
        message:
          'SMTP is not configured yet. An admin must set it up via PATCH /settings/mail.',
      });
    }

    const info = await sendSmtpMessage(config, message);
    const reference = info.messageId ?? 'unknown';

    this.logger.log(
      `[mail:smtp] Đã gửi email "${message.subject}" cho ${message.to} (messageId=${reference})`,
    );

    return { transport: this.kind, reference };
  }

  private get encryptionKey(): string {
    return this.configService.getOrThrow<SettingsConfig>('settings')
      .encryptionKey;
  }
}

/**
 * Dựng transporter + gửi 1 email qua nodemailer. Tách khỏi class trên để
 * `MailSettingsService.sendTest()` (nút "gửi thử" trong /settings/mail) dùng
 * lại được CÙNG một logic gửi, thay vì đi qua `MAIL_TRANSPORT` env (có thể
 * đang là `dev` trong lúc admin muốn kiểm tra SMTP thật ngay trên môi trường
 * dev).
 */
export async function sendSmtpMessage(
  config: ResolvedSmtpConfig,
  message: MailMessage,
): Promise<{ messageId?: string }> {
  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.username
      ? { user: config.username, pass: config.password ?? '' }
      : undefined,
  });

  return transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
