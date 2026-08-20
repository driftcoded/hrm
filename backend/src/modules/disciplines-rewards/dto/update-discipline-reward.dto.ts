import { PartialType } from '@nestjs/swagger';
import { CreateDisciplineRewardDto } from './create-discipline-reward.dto';

/**
 * Body của `PATCH /employees/:employeeId/disciplines-rewards/:recordId`.
 *
 * Mọi trường tuỳ chọn, kể cả `type`.
 */
export class UpdateDisciplineRewardDto extends PartialType(
  CreateDisciplineRewardDto,
) {}
