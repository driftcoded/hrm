import { RenderedMailTemplate } from './reset-password.template';

export interface NotificationTemplateData {
  /** Recipient's display name. */
  recipientName: string;
  subject: string;
  /** Sender-authored content, as plain text. */
  body: string;
}

/**
 * Template for HR-authored announcement emails (`POST /employees/email`).
 *
 * `body` is treated as PLAIN TEXT, never HTML: it comes straight from a
 * textarea, and trusting it as HTML would let the sender inject arbitrary
 * markup into another person's inbox. Everything is escaped before the
 * paragraphs are assembled.
 */
export function renderNotificationEmail(
  data: NotificationTemplateData,
): RenderedMailTemplate {
  const paragraphs = toParagraphs(data.body);

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">
  <p>Xin chào <strong>${escapeHtml(data.recipientName)}</strong>,</p>
${paragraphs.map((line) => `  <p>${escapeHtml(line).replace(/\n/g, '<br />')}</p>`).join('\n')}
  <p style="color:#888;font-size:12px;margin-top:24px">
    Email này được gửi từ hệ thống HRM. Vui lòng không trả lời trực tiếp.
  </p>
</div>`.trim();

  const text = [`Xin chào ${data.recipientName},`, '', data.body].join('\n');

  return { subject: data.subject, html, text };
}

/** Splits on blank lines — each block becomes a paragraph; single line breaks within a block are preserved. */
function toParagraphs(body: string): string[] {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
