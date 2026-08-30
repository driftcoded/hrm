import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shape for `GET /settings/mail` — NEVER contains the real password
 * or its ciphertext, only `hasPassword` so the frontend knows whether it's configured.
 */
export class MailSettingsResponseDto {
  @ApiProperty({ example: 'smtp.gmail.com', nullable: true, type: String })
  smtpHost: string | null;

  @ApiProperty({ example: 587, nullable: true, type: Number })
  smtpPort: number | null;

  @ApiProperty({ example: true })
  smtpSecure: boolean;

  @ApiProperty({
    example: 'no-reply@company.com',
    nullable: true,
    type: String,
  })
  smtpUsername: string | null;

  @ApiProperty({
    example: true,
    description: 'true nếu đã lưu mật khẩu (không trả giá trị thật)',
  })
  hasPassword: boolean;

  @ApiProperty({
    example: 'no-reply@company.com',
    nullable: true,
    type: String,
  })
  smtpFromEmail: string | null;

  @ApiProperty({ example: 'HRM System', nullable: true, type: String })
  smtpFromName: string | null;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  updatedAt: string;
}
