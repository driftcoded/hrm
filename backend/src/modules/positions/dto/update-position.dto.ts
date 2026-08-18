import { PartialType } from '@nestjs/swagger';
import { CreatePositionDto } from './create-position.dto';

/** PATCH /positions/:id — an absent field means unchanged. */
export class UpdatePositionDto extends PartialType(CreatePositionDto) {}
