export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailSendResult {
  transport: 'dev' | 'smtp';
  /** Đường dẫn file HTML (transport dev) hoặc messageId trả về từ SMTP server. */
  reference: string;
}

/**
 * Transport gửi mail. Có 2 driver:
 *  - `DevFileMailTransport`: ghi ra file HTML trong logs/mail (dev/test)
 *  - `SmtpMailTransport`: gửi thật qua SMTP, cấu hình đọc từ
 *    `system_mail_settings` (DB, admin cấu hình qua `/settings/mail`)
 */
export interface MailTransport {
  readonly kind: 'dev' | 'smtp';
  send(message: MailMessage): Promise<MailSendResult>;
}
