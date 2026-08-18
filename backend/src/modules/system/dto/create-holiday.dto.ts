import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { HolidayType } from '../entities/holiday.entity';

/**
 * WARNING: does NOT accept `year` from the client: the `holidays.year` column
 * is always derived from `holidayDate` so the two columns never drift apart
 * (schema §5.5 has both columns but no constraint forcing them to match).
 */
export class CreateHolidayDto {
  @ApiProperty({ example: 'Tết Dương lịch', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: '2027-01-01',
    description: 'YYYY-MM-DD (api-spec.md §1.4). Duy nhất trong toàn bảng.',
  })
  @IsCalendarDate()
  holidayDate: string;

  @ApiPropertyOptional({
    enum: HolidayType,
    default: HolidayType.NATIONAL,
  })
  @IsOptional()
  @IsEnum(HolidayType)
  type?: HolidayType;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBooleanValue()
  isPaid?: boolean;

  @ApiPropertyOptional({ example: null, nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null;
}
