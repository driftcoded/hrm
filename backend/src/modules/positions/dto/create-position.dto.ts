import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';

/** `positions.code` VARCHAR(20) UNIQUE, e.g. `DEV_JUNIOR` (schema §2.2). */
export const POSITION_CODE_PATTERN = /^[A-Za-z0-9_]{2,20}$/;

/** `level`: 1 Staff · 2 Senior · 3 Lead · 4 Manager · 5 Director (schema §2.2). */
export const MIN_POSITION_LEVEL = 1;
export const MAX_POSITION_LEVEL = 5;

/** DECIMAL(15,2) → maximum representable value. */
export const MAX_SALARY_VALUE = 9_999_999_999_999;

export class CreatePositionDto {
  @ApiProperty({ example: 'DEV_SENIOR', maxLength: 20 })
  @IsString()
  @Matches(POSITION_CODE_PATTERN, {
    message: 'code must be 2-20 characters of letters, digits or underscore',
  })
  code: string;

  @ApiProperty({ example: 'Developer Senior', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 2, description: 'departments.id sở hữu chức vụ này' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId: number;

  @ApiProperty({
    example: 2,
    minimum: MIN_POSITION_LEVEL,
    maximum: MAX_POSITION_LEVEL,
    description: '1 Staff · 2 Senior · 3 Lead · 4 Manager · 5 Director',
  })
  @Type(() => Number)
  @IsInt()
  @Min(MIN_POSITION_LEVEL)
  @Max(MAX_POSITION_LEVEL)
  level: number;

  @ApiPropertyOptional({
    example: 20000000,
    nullable: true,
    description: 'VNĐ (api-spec.md §1.5) – number, không định dạng',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_SALARY_VALUE)
  minSalary?: number | null;

  @ApiPropertyOptional({ example: 35000000, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_SALARY_VALUE)
  maxSalary?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBooleanValue()
  isActive?: boolean;
}
