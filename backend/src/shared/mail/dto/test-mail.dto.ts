import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** `POST /settings/mail/test` — gửi thử bằng cấu hình ĐANG LƯU, không phải body này. */
export class TestMailDto {
  @ApiProperty({ example: 'admin@company.com' })
  @IsEmail()
  to: string;
}
