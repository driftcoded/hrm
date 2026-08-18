import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';

/**
 * `departments.code` is VARCHAR(20) UNIQUE (database-schema.md §2.1).
 * api-spec.md does not specify a format; letters/digits/underscore was
 * chosen to match the schema's examples (`IT`, `HR`, `FIN`, `SALE`). The
 * service normalizes to UPPERCASE so `hr` and `HR` don't create two
 * different departments.
 */
export const DEPARTMENT_CODE_PATTERN = /^[A-Za-z0-9_]{2,20}$/;

/** `sort_order` is a signed SMALLINT. */
export const MAX_SORT_ORDER = 32767;

export class CreateDepartmentDto {
  @ApiProperty({ example: 'FIN', maxLength: 20 })
  @IsString()
  @Matches(DEPARTMENT_CODE_PATTERN, {
    message: 'code must be 2-20 characters of letters, digits or underscore',
  })
  code: string;

  @ApiProperty({ example: 'Phòng Tài chính', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Quản lý thu chi, kế toán', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Phòng ban cha; null = phòng ban gốc',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentId?: number | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'employees.id của trưởng phòng',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  managerId?: number | null;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: MAX_SORT_ORDER })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SORT_ORDER)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBooleanValue()
  isActive?: boolean;
}
