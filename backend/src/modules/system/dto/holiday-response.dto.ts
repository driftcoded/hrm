import { ApiProperty } from '@nestjs/swagger';
import { HolidayType } from '../entities/holiday.entity';

/** Response shape for `/holidays` and `/system/holidays` (api-spec.md §20). */
export class HolidayResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Tết Dương lịch' })
  name: string;

  @ApiProperty({ example: '2026-01-01', description: 'YYYY-MM-DD' })
  holidayDate: string;

  @ApiProperty({ enum: HolidayType, example: HolidayType.NATIONAL })
  type: HolidayType;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: true })
  isPaid: boolean;

  @ApiProperty({ example: null, nullable: true, type: String })
  note: string | null;
}
