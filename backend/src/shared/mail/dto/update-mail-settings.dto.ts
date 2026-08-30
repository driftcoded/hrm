import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * `PATCH /settings/mail`. The core fields (host/port/secure/fromEmail) are
 * REQUIRED on every request — an SMTP config is meaningless without them —
 * and `PartialType` is deliberately not used here to avoid the
 * `class-validator` bug hit in Phase 2.1 (`@IsOptional()` treats `null` as
 * "skip validation" even for non-nullable fields — see
 * common/utils/reject-null.util.ts).
 *
 * `smtpUsername`/`smtpFromName` legitimately accept `string | null` (an
 * anonymous SMTP relay needs no username; an empty from-name falls back to
 * from-email in the service). Leaving `smtpPassword` empty (undefined OR '')
 * means KEEP the currently saved password — this endpoint has no way to read
 * back the old password to show on the form, so "left blank" must mean
 * "unchanged", not "cleared".
 */
export class UpdateMailSettingsDto {
  @ApiProperty({ example: 'smtp.gmail.com', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  smtpHost: string;

  @ApiProperty({ example: 587, minimum: 1, maximum: 65535 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort: number;

  @ApiProperty({
    example: true,
    description:
      'true = TLS/SSL (port 465 thường dùng true, 587 dùng STARTTLS/false)',
  })
  @IsBoolean()
  smtpSecure: boolean;

  @ApiPropertyOptional({
    example: 'no-reply@company.com',
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpUsername?: string | null;

  @ApiPropertyOptional({
    description:
      'Bỏ trống = giữ nguyên mật khẩu đã lưu. Có giá trị = thay thế.',
    minLength: 1,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpPassword?: string;

  @ApiProperty({ example: 'no-reply@company.com', maxLength: 150 })
  @IsEmail()
  @MaxLength(150)
  smtpFromEmail: string;

  @ApiPropertyOptional({
    example: 'HRM System',
    nullable: true,
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  smtpFromName?: string | null;
}
