import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { SalaryAdvanceStatus } from '../entities/salary-advance.entity';

/** Query của `GET /salary-advances`. */
export class FilterSalaryAdvanceDto extends PaginationDto {
  @ApiPropertyOptional({ example: 51 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional({ enum: SalaryAdvanceStatus })
  @IsOptional()
  @IsEnum(SalaryAdvanceStatus)
  status?: SalaryAdvanceStatus;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  deductYear?: number;

  @ApiPropertyOptional({ example: 9, minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  deductMonth?: number;
}
