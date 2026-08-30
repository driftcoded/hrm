import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthConfig } from '@/config/auth.config';
import { MAIL_TRANSPORT } from './mail.constants';
import { MailSendResult, MailTransport } from './mail-transport.interface';
import { renderNotificationEmail } from './templates/notification.template';
import { renderResetPasswordEmail } from './templates/reset-password.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly configService: ConfigService,
  ) {}

  /** The transport currently in use – useful for health checks / tests. */
  get transportKind(): 'dev' | 'smtp' {
    return this.transport.kind;
  }

  /**
   * Sends the password reset email.
   * Do NOT log rawToken / resetUrl (CLAUDE.md §Security) – only log recipient + reference.
   */
  async sendResetPasswordEmail(params: {
    to: string;
    recipientName: string;
    rawToken: string;
    expiresInMinutes: number;
  }): Promise<MailSendResult> {
    const auth = this.configService.getOrThrow<AuthConfig>('auth');
    const resetUrl = `${auth.frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(params.rawToken)}`;

    const rendered = renderResetPasswordEmail({
      recipientName: params.recipientName,
      resetUrl,
      expiresInMinutes: params.expiresInMinutes,
    });

    const result = await this.transport.send({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    this.logger.log(
      `Reset-password email queued for ${params.to} via transport=${result.transport}`,
    );

    return result;
  }

  /**
   * Sends a user-composed notification email.
   *
   * Goes through `MAIL_TRANSPORT` like every other email: `smtp` sends for
   * real using the config an admin saved at `/settings/mail`, `dev` writes
   * to a file. Never calls SMTP directly, so a dev environment can't
   * accidentally fire real emails at employees.
   */
  async sendNotificationEmail(params: {
    to: string;
    recipientName: string;
    subject: string;
    body: string;
  }): Promise<MailSendResult> {
    const rendered = renderNotificationEmail({
      recipientName: params.recipientName,
      subject: params.subject,
      body: params.body,
    });

    const result = await this.transport.send({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    this.logger.log(
      `Notification email queued for ${params.to} via transport=${result.transport}`,
    );

    return result;
  }
}
