import { PartialType } from '@nestjs/swagger';
import { CreateHolidayDto } from './create-holiday.dto';

/**
 * PATCH /holidays/:id — an absent field means no change.
 * Changing `holidayDate` automatically recomputes the `year` column.
 */
export class UpdateHolidayDto extends PartialType(CreateHolidayDto) {}
