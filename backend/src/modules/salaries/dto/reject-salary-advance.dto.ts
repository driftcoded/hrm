import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body của `PATCH /salary-advances/:id/reject` — lý do BẮT BUỘC. */
export class RejectSalaryAdvanceDto {
  @ApiProperty({ example: 'Vượt hạn mức tạm ứng trong quý', maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
