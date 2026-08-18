import { PartialType } from '@nestjs/swagger';
import { CreateLeaveTypeDto } from './create-leave-type.dto';

/** PATCH /leave-types/:id — an absent field means "leave unchanged". */
export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) {}
