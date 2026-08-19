import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ContractStatus, ContractType } from '../entities/contract.entity';

export const CONTRACT_SORT_KEYS = [
  'contractNumber',
  'startDate',
  'endDate',
  'createdAt',
] as const;

export type ContractSortKey = (typeof CONTRACT_SORT_KEYS)[number];

/** Trần của `expiringDays` – hỏi xa hơn 1 năm thì lọc mất ý nghĩa cảnh báo. */
export const MAX_EXPIRING_DAYS = 365;

export class FilterContractDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CONTRACT_SORT_KEYS, default: 'startDate' })
  @IsOptional()
  @IsIn(CONTRACT_SORT_KEYS)
  sort?: ContractSortKey = 'startDate';

  @ApiPropertyOptional({ example: 51 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ enum: ContractType })
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @ApiPropertyOptional({
    example: 30,
    minimum: 1,
    maximum: MAX_EXPIRING_DAYS,
    description:
      'Hợp đồng sắp hết hạn trong N ngày tới (api-spec.md §6). Chỉ tính hợp đồng có end_date và chưa quá hạn.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_EXPIRING_DAYS)
  expiringDays?: number;
}
