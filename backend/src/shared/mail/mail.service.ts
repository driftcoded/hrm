import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthConfig } from '@/config/auth.config';
import { MAIL_TRANSPORT } from './mail.constants';
import { MailSendResult, MailTransport } from './mail-transport.interface';
import { renderResetPasswordEmail } from './templates/reset-password.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly configService: ConfigService,
  ) {}

  /** Transport đang dùng – hữu ích cho health check / test. */
  get transportKind(): 'dev' | 'ses' {
    return this.transport.kind;
  }

  /**
   * Gửi email chứa link đặt lại mật khẩu.
   * KHÔNG log rawToken / resetUrl (CLAUDE.md §Bảo mật) – chỉ log recipient + reference.
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
}
