import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { MAX_POSITION_LEVEL, MIN_POSITION_LEVEL } from './create-position.dto';

/** Whitelist of sortable columns – prevents interpolating `sort` directly into SQL. */
export const POSITION_SORT_KEYS = [
  'code',
  'name',
  'level',
  'createdAt',
] as const;

export type PositionSortKey = (typeof POSITION_SORT_KEYS)[number];

export class FilterPositionDto extends PaginationDto {
  @ApiPropertyOptional({ enum: POSITION_SORT_KEYS, default: 'code' })
  @IsOptional()
  @IsIn(POSITION_SORT_KEYS)
  sort?: PositionSortKey = 'code';

  @ApiPropertyOptional({ example: 2, description: 'Lọc theo phòng ban' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiPropertyOptional({
    minimum: MIN_POSITION_LEVEL,
    maximum: MAX_POSITION_LEVEL,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_POSITION_LEVEL)
  @Max(MAX_POSITION_LEVEL)
  level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanValue()
  isActive?: boolean;
}
