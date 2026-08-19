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
 * `PATCH /settings/mail`. Các field lõi (host/port/secure/fromEmail) là BẮT
 * BUỘC trên mỗi lần gửi — cấu hình SMTP không có ý nghĩa nếu thiếu, và không
 * dùng `PartialType` ở đây để tránh lỗi `class-validator` đã gặp ở Giai đoạn
 * 2.1 (`@IsOptional()` coi `null` là "bỏ qua validate" luôn cho cả field
 * không nullable — xem common/utils/reject-null.util.ts).
 *
 * `smtpUsername`/`smtpFromName` là `string | null` hợp lệ (SMTP relay ẩn danh
 * không cần username; from-name rỗng thì service tự dùng lại from-email).
 * `smtpPassword` bỏ trống (undefined HOẶC '') = GIỮ NGUYÊN mật khẩu đã lưu —
 * endpoint này không có cách nào đọc lại mật khẩu cũ để hiện trên form, nên
 * "để trống" phải có nghĩa là "không đổi", không phải "xoá".
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
