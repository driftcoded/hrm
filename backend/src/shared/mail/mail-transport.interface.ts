export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailSendResult {
  transport: 'dev' | 'smtp';
  /** HTML file path (dev transport) or the messageId returned by the SMTP server. */
  reference: string;
}

/**
 * Mail-sending transport. There are 2 drivers:
 *  - `DevFileMailTransport`: writes an HTML file under logs/mail (dev/test)
 *  - `SmtpMailTransport`: sends for real via SMTP, config read from
 *    `system_mail_settings` (DB, configured by an admin via `/settings/mail`)
 */
export interface MailTransport {
  readonly kind: 'dev' | 'smtp';
  send(message: MailMessage): Promise<MailSendResult>;
}
