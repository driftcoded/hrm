import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginUserDto {
  /**
   * Định danh đăng nhập: chấp nhận `users.username` HOẶC `users.email`
   * (email không phân biệt hoa/thường). Giữ tên field là `username` theo
   * api-spec.md §2; frontend hiển thị nhãn "Email hoặc tên đăng nhập".
   */
  @ApiProperty({
    example: 'admin',
    description: 'Tên đăng nhập hoặc email',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'Abc@12345' })
  @IsString()
  @IsNotEmpty()
  password: string;

  /**
   * "Ghi nhớ đăng nhập" – CHỈ ảnh hưởng thời gian sống của cookie refresh token:
   *  - `true`  → cookie có maxAge 7 ngày (còn sau khi đóng browser)
   *  - `false` → session cookie (mất khi đóng browser)
   * Bản ghi `refresh_tokens.expires_at` trong DB luôn là 7 ngày trong cả 2 trường hợp.
   */
  @ApiPropertyOptional({ default: false, description: 'Ghi nhớ đăng nhập' })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean = false;
}
