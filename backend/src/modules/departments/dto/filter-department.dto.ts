import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';

/**
 * Columns allowed for sorting. Whitelisted via the type + `@IsIn` so the
 * `sort` value is NEVER interpolated freely into SQL (CLAUDE.md §Security).
 */
export const DEPARTMENT_SORT_KEYS = [
  'code',
  'name',
  'sortOrder',
  'createdAt',
] as const;

export type DepartmentSortKey = (typeof DEPARTMENT_SORT_KEYS)[number];

export class FilterDepartmentDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DEPARTMENT_SORT_KEYS, default: 'sortOrder' })
  @IsOptional()
  @IsIn(DEPARTMENT_SORT_KEYS)
  sort?: DepartmentSortKey = 'sortOrder';

  @ApiPropertyOptional({
    description:
      'true → trả về cây phòng ban (mảng lồng nhau, bỏ qua phân trang) thay vì flat list — api-spec.md §4',
  })
  @IsOptional()
  @IsBooleanValue()
  tree?: boolean;

  @ApiPropertyOptional({ description: 'Lọc theo phòng ban cha' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái hoạt động' })
  @IsOptional()
  @IsBooleanValue()
  isActive?: boolean;
}
