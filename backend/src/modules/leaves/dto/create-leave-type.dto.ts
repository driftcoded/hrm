import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
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
import { LeaveApplicableGender } from '../entities/leave-type.entity';

/** `leave_types.code` VARCHAR(20) UNIQUE, e.g. `ANNUAL` (schema §5.2). */
export const LEAVE_TYPE_CODE_PATTERN = /^[A-Za-z0-9_]{2,20}$/;

/** `days_per_year` DECIMAL(5,1) → max 9999.9; practical limit is 366 days/year. */
export const MAX_DAYS_PER_YEAR = 366;

/** `min_days` DECIMAL(4,1) – half a day is the smallest leave unit. */
export const MAX_MIN_DAYS = 366;

/** `max_consecutive` / `advance_notice_days` are signed SMALLINT columns. */
export const MAX_SMALLINT = 32767;

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'ANNUAL', maxLength: 20 })
  @IsString()
  @Matches(LEAVE_TYPE_CODE_PATTERN, {
    message: 'code must be 2-20 characters of letters, digits or underscore',
  })
  code: string;

  @ApiProperty({ example: 'Nghỉ phép năm', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 12,
    description:
      'Số ngày/năm. 0 = không giới hạn hoặc tính theo từng trường hợp',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(MAX_DAYS_PER_YEAR)
  daysPerYear: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBooleanValue()
  isPaid?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBooleanValue()
  requireApproval?: boolean;

  @ApiPropertyOptional({
    example: 0.5,
    default: 0.5,
    description: 'Số ngày tối thiểu mỗi lần nghỉ',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(MAX_MIN_DAYS)
  minDays?: number;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Số ngày liên tục tối đa; null = không giới hạn',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SMALLINT)
  maxConsecutive?: number | null;

  @ApiPropertyOptional({
    example: 3,
    default: 1,
    description: 'Phải báo trước tối thiểu X ngày (0 = không cần báo trước)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SMALLINT)
  advanceNoticeDays?: number;

  @ApiPropertyOptional({
    enum: LeaveApplicableGender,
    default: LeaveApplicableGender.ALL,
  })
  @IsOptional()
  @IsEnum(LeaveApplicableGender)
  applicableGender?: LeaveApplicableGender;

  @ApiPropertyOptional({
    example: 'Điều 113 BLLĐ 2019',
    nullable: true,
    description: 'Mô tả / căn cứ pháp lý',
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBooleanValue()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SMALLINT)
  sortOrder?: number;
}
