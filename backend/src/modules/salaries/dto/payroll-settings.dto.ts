import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, Min } from 'class-validator';

/** Body của `PATCH /payroll-settings`. Mọi trường tuỳ chọn. */
export class UpdatePayrollSettingsDto {
  @ApiPropertyOptional({
    example: 1,
    enum: [1, 2, 3, 4],
    description:
      'Vùng lương tối thiểu của trụ sở — quyết định TRẦN đóng BHTN (20 × lương tối thiểu vùng).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2, 3, 4])
  minimumWageRegion?: number;

  @ApiPropertyOptional({
    example: 730000,
    description: 'Miễn thuế TNCN tới 730.000; phần vượt vẫn chịu thuế.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mealAllowance?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transportAllowance?: number;

  @ApiPropertyOptional({ example: 300000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  phoneAllowance?: number;

  @ApiPropertyOptional({
    example: 500000,
    description: 'Mất trắng nếu tháng đó có ngày nghỉ không lương.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  attendanceAllowance?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Có trả tiền làm thêm giờ suy ra từ chấm công hay không.',
  })
  @IsOptional()
  @IsBoolean()
  payOvertime?: boolean;
}

export class PayrollSettingsResponseDto {
  @ApiProperty({ example: 1 })
  minimumWageRegion: number;

  @ApiProperty({ example: 730000 })
  mealAllowance: number;

  @ApiProperty({ example: 0 })
  transportAllowance: number;

  @ApiProperty({ example: 0 })
  phoneAllowance: number;

  @ApiProperty({ example: 0 })
  attendanceAllowance: number;

  @ApiProperty({ example: true })
  payOvertime: boolean;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  updatedAt: string;
}
