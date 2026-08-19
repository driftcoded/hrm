import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../entities/user.entity';

/** `users.username` là VARCHAR(50) UNIQUE (database-schema.md §1.4). */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;

/** Độ dài tối thiểu của mật khẩu, khớp với `/auth/reset-password`. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/**
 * `POST /users` (api-spec.md §13) — tạo tài khoản đăng nhập cho một nhân viên.
 *
 * Đây là bước 4 ("tài khoản") của wizard tạo nhân viên: hồ sơ nhân viên và tài
 * khoản đăng nhập là HAI bản ghi khác nhau (`employees` ↔ `users` nối qua
 * `users.employee_id` UNIQUE), nên tạo hồ sơ xong vẫn phải tạo tài khoản riêng.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'binh.nguyen', maxLength: 50 })
  @IsString()
  @Matches(USERNAME_PATTERN, {
    message:
      'username must be 3-50 characters of letters, digits, dot, underscore or hyphen',
  })
  username: string;

  @ApiProperty({ example: 'binh.nguyen@company.com', maxLength: 100 })
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({
    example: 'Temp@2026',
    minLength: MIN_PASSWORD_LENGTH,
    description: 'Mật khẩu tạm; hash bcrypt salt rounds 10 trước khi lưu',
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  // bcrypt chỉ dùng 72 byte đầu — chuỗi dài hơn tạo cảm giác an toàn giả.
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;

  @ApiProperty({ example: 5, description: 'roles.id (1 admin … 5 employee)' })
  @Type(() => Number)
  @IsInt()
  roleId: number;

  @ApiPropertyOptional({
    example: 51,
    nullable: true,
    description:
      'employees.id được gắn với tài khoản; null = tài khoản chưa gắn hồ sơ',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number | null;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
