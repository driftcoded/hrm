import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FIRST_SUPPORTED_PAYROLL_YEAR } from '@/common/constants/payroll.constant';
import { SalaryStatus } from '../entities/salary.entity';

export const SALARY_SORT_KEYS = [
  'netSalary',
  'grossSalary',
  'employeeCode',
] as const;

export type SalarySortKey = (typeof SALARY_SORT_KEYS)[number];

/**
 * Query của `GET /salaries`.
 *
 * `year` BẮT BUỘC, `month` thì không. Bảng lương là số liệu CỦA MỘT KỲ; trộn
 * nhiều năm vào một danh sách thì cột "thực nhận" không còn cộng lại thành gì
 * có nghĩa. Cho phép bỏ trống tháng để xem cả năm của một người — đó là câu hỏi
 * thật khi tra cứu thu nhập cả năm.
 */
export class FilterSalaryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SALARY_SORT_KEYS, default: 'employeeCode' })
  @IsOptional()
  @IsIn(SALARY_SORT_KEYS)
  sort?: SalarySortKey = 'employeeCode';

  @ApiPropertyOptional({ example: 2026, minimum: FIRST_SUPPORTED_PAYROLL_YEAR })
  @Type(() => Number)
  @IsInt()
  @Min(FIRST_SUPPORTED_PAYROLL_YEAR)
  year: number;

  @ApiPropertyOptional({ example: 8, minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ example: 51 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiPropertyOptional({ enum: SalaryStatus })
  @IsOptional()
  @IsEnum(SalaryStatus)
  status?: SalaryStatus;
}
