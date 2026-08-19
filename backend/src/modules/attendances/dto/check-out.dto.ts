import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body của `POST /attendances/check-out` — xem ghi chú ở `CheckInDto`. */
export class CheckOutDto {
  @ApiPropertyOptional({
    description: 'Ghi chú tuỳ chọn cho lần chấm ra',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
