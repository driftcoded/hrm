import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';
import { HolidayCalendar, HolidayType } from '../entities/holiday.entity';
import { MAX_HOLIDAY_YEAR, MIN_HOLIDAY_YEAR } from './filter-holiday.dto';

export class CreateHolidayDto {
  @ApiProperty({ example: 'TET', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Tết Nguyên đán', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ enum: HolidayType, default: HolidayType.NATIONAL })
  @IsOptional()
  @IsEnum(HolidayType)
  type?: HolidayType;

  @ApiPropertyOptional({
    enum: HolidayCalendar,
    default: HolidayCalendar.SOLAR,
  })
  @IsOptional()
  @IsEnum(HolidayCalendar)
  calendar?: HolidayCalendar;

  @ApiProperty({ example: 1, description: 'Tháng neo (1–12)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 1, description: 'Ngày neo (1–31)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  day: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-366)
  @Max(366)
  offsetDays?: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  durationDays?: number;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'NULL = mọi năm',
  })
  @IsOptional()
  @ValidateIf((o: CreateHolidayDto) => o.year !== null)
  @Type(() => Number)
  @IsInt()
  @Min(MIN_HOLIDAY_YEAR)
  @Max(MAX_HOLIDAY_YEAR)
  year?: number | null;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBooleanValue()
  isPaid?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBooleanValue()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @ApiPropertyOptional({ example: null, nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null;
}
