import { ApiProperty } from '@nestjs/swagger';

export class TestMailResponseDto {
  @ApiProperty({ example: true })
  sent: boolean;

  @ApiProperty({ example: '<abc123@smtp.gmail.com>' })
  reference: string;
}
