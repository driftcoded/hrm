import { PartialType } from '@nestjs/swagger';
import { CreateDepartmentDto } from './create-department.dto';

/**
 * PATCH /departments/:id — every field is optional.
 * A missing field means no change; `parentId: null` / `managerId: null`
 * clears the link.
 */
export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}
