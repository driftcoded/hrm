import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';

/** `PATCH /contracts/:id/terminate` (api-spec.md §6). */
export class TerminateContractDto {
  @ApiProperty({ example: '2026-10-31' })
  @IsCalendarDate()
  terminatedDate: string;

  @ApiProperty({ example: 'Nhân viên xin thôi việc', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  terminatedReason: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Ghi chú thêm, ví dụ số quyết định chấm dứt',
  })
  @IsOptional()
  @IsString()
  note?: string | null;
}
