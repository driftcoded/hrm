import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** `POST /settings/mail/test` — sends using the CURRENTLY SAVED config, not this request body. */
export class TestMailDto {
  @ApiProperty({ example: 'admin@company.com' })
  @IsEmail()
  to: string;
}
