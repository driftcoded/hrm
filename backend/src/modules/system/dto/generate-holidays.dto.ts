import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DEFAULT_NATIONAL_DAY_EXTRA,
  DEFAULT_TET_DAYS_BEFORE,
  TET_TOTAL_DAYS,
  type NationalDayExtra,
} from '@/common/utils/vietnam-holidays.util';
import { HolidayResponseDto } from './holiday-response.dto';

/**
 * Body của `POST /holidays/generate`.
 *
 * Hai tham số đầu là hai thứ Chính phủ chốt lại mỗi năm, luật không ấn định:
 * nghỉ Tết bắt đầu từ ngày nào, và ngày liền kề nào của 2/9 được nghỉ.
 */
export class GenerateHolidaysDto {
  @ApiProperty({ example: 2027, minimum: 1900, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({
    example: DEFAULT_TET_DAYS_BEFORE,
    minimum: 0,
    maximum: TET_TOTAL_DAYS - 1,
    description: `Số ngày nghỉ trước mùng 1 Tết; ${TET_TOTAL_DAYS} ngày còn lại tính từ mùng 1.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(TET_TOTAL_DAYS - 1)
  tetDaysBefore?: number;

  @ApiPropertyOptional({
    example: DEFAULT_NATIONAL_DAY_EXTRA,
    enum: ['before', 'after'],
    description: 'Ngày nghỉ thêm của Quốc khánh: 1/9 hay 3/9.',
  })
  @IsOptional()
  @IsIn(['before', 'after'])
  nationalDayExtra?: NationalDayExtra;

  @ApiPropertyOptional({
    default: true,
    description:
      'Thêm ngày nghỉ bù khi ngày lễ rơi vào thứ Bảy/Chủ nhật (Điều 111 khoản 3).',
  })
  @IsOptional()
  @IsBoolean()
  compensateWeekends?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Chỉ xem trước, KHÔNG ghi vào cơ sở dữ liệu. Dùng để đối chiếu trước khi tạo.',
  })
  @IsOptional()
  @IsBoolean()
  preview?: boolean;
}

export class GenerateHolidaysResultDto {
  @ApiProperty({ example: 2027 })
  year: number;

  @ApiProperty({ example: 11, description: 'Số ngày vừa được tạo.' })
  created: number;

  @ApiProperty({
    example: 2,
    description: 'Số ngày đã có sẵn nên bỏ qua — bản ghi cũ không bị ghi đè.',
  })
  skipped: number;

  @ApiProperty({ example: false })
  preview: boolean;

  @ApiProperty({
    type: [HolidayResponseDto],
    description: 'Toàn bộ lịch nghỉ của năm sau khi sinh, đã sắp theo ngày.',
  })
  holidays: HolidayResponseDto[];
}
