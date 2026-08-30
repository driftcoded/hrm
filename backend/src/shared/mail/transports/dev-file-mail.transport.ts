import { Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import {
  MailMessage,
  MailSendResult,
  MailTransport,
} from '../mail-transport.interface';

/**
 * Dev transport: does not send real email, instead renders it as an HTML
 * file for manual inspection or automated tests: `logs/mail/<timestamp>-<to>.html`.
 *
 * Dev/test only. The file contains the full email body (including password
 * reset links), so `logs/` must always stay in .gitignore, and this
 * transport must never be enabled in production (see MailModule, which
 * warns when MAIL_TRANSPORT=dev is left set in production).
 * The log line only records the file path and recipient, never the token
 * (see CLAUDE.md security rules).
 */
export class DevFileMailTransport implements MailTransport {
  readonly kind = 'dev' as const;

  private readonly logger = new Logger(DevFileMailTransport.name);

  constructor(private readonly outputDir: string) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const dir = resolve(process.cwd(), this.outputDir);
    await mkdir(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeRecipient = message.to.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = join(dir, `${timestamp}-${safeRecipient}.html`);

    const document = [
      '<!doctype html>',
      '<html lang="vi"><head><meta charset="utf-8">',
      `<title>${escapeHtml(message.subject)}</title></head><body>`,
      '<pre style="font-family:monospace;background:#f5f5f5;padding:12px">',
      `To: ${escapeHtml(message.to)}\nSubject: ${escapeHtml(message.subject)}\nDate: ${new Date().toISOString()}`,
      '</pre>',
      message.html,
      '<hr><h3>Plain text version</h3>',
      `<pre>${escapeHtml(message.text)}</pre>`,
      '</body></html>',
    ].join('\n');

    await writeFile(filePath, document, 'utf8');

    this.logger.log(
      `[mail:dev] Đã ghi email "${message.subject}" cho ${message.to} -> ${filePath}`,
    );

    return { transport: this.kind, reference: filePath };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
