import { ApiProperty } from '@nestjs/swagger';
import { HolidayCalendar, HolidayType } from '../entities/holiday.entity';

/** Rule definition — returned by CRUD endpoints. */
export class HolidayResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'TET' })
  code: string;

  @ApiProperty({ example: 'Tết Nguyên đán' })
  name: string;

  @ApiProperty({ enum: HolidayType, example: HolidayType.NATIONAL })
  type: HolidayType;

  @ApiProperty({ enum: HolidayCalendar, example: HolidayCalendar.LUNAR })
  calendar: HolidayCalendar;

  @ApiProperty({ example: 1, description: 'Tháng neo (1–12)' })
  month: number;

  @ApiProperty({ example: 1, description: 'Ngày neo (1–31)' })
  day: number;

  @ApiProperty({ example: -1, description: 'Số ngày lệch so với ngày neo' })
  offsetDays: number;

  @ApiProperty({ example: 5, description: 'Tổng số ngày nghỉ của kỳ' })
  durationDays: number;

  @ApiProperty({ example: null, nullable: true, type: Number })
  year: number | null;

  @ApiProperty({ example: true })
  isPaid: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 2 })
  sortOrder: number;

  @ApiProperty({ example: null, nullable: true, type: String })
  note: string | null;
}

/** Concrete resolved date — returned by findByYear and generate. */
export class HolidayDateDto {
  @ApiProperty({ example: '2026-02-17', description: 'YYYY-MM-DD' })
  holidayDate: string;

  @ApiProperty({ example: 'TET' })
  code: string;

  @ApiProperty({ example: 'Tết Nguyên đán' })
  name: string;

  @ApiProperty({ example: 'national' })
  type: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: true })
  isPaid: boolean;

  @ApiProperty({ example: 1 })
  dayIndex: number;

  @ApiProperty({ example: 5 })
  dayCount: number;

  @ApiProperty({ example: false })
  isCompensatory: boolean;

  @ApiProperty({ example: null, nullable: true, type: String })
  note: string | null;
}
