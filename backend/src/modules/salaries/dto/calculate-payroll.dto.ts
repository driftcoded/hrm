import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FIRST_SUPPORTED_PAYROLL_YEAR } from '@/common/constants/payroll.constant';

/**
 * Body của `POST /salaries/calculate`.
 *
 * `dryRun` không phải tuỳ chọn cho vui: tính lương chạm vào cả công ty trong
 * một lần bấm và không có nút hoàn tác. Người bấm cần thấy trước sẽ tạo bao
 * nhiêu dòng, ghi đè bao nhiêu, bỏ qua bao nhiêu dòng đã chốt.
 */
export class CalculatePayrollDto {
  @ApiProperty({ example: 2026, minimum: FIRST_SUPPORTED_PAYROLL_YEAR })
  @Type(() => Number)
  @IsInt()
  @Min(FIRST_SUPPORTED_PAYROLL_YEAR)
  year: number;

  @ApiProperty({ example: 8, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Chỉ tính thử và trả về thống kê, KHÔNG ghi vào database.',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
