import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape trả về của `GET /settings/mail` — KHÔNG BAO GIỜ chứa mật khẩu thật
 * hay ciphertext, chỉ `hasPassword` để frontend biết đã cấu hình hay chưa.
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
