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
 * Sends real email via SMTP. Configuration is read FROM the database on
 * EVERY send (never cached in memory): an internal HR system's email volume
 * is low enough that the performance cost isn't worth risking a send with
 * stale credentials right after an admin changes the SMTP password but
 * before the app restarts.
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
 * Builds a transporter and sends one email via nodemailer. Kept outside the
 * class above so `MailSettingsService.sendTest()` (the "send test" button on
 * /settings/mail) can reuse the exact same send logic without going through
 * the `MAIL_TRANSPORT` env var, which may be set to `dev` while an admin
 * wants to verify real SMTP delivery in the dev environment.
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
