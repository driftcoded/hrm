import { PartialType } from '@nestjs/swagger';
import { CreateDisciplineRewardDto } from './create-discipline-reward.dto';

/**
 * Body của `PATCH /employees/:employeeId/disciplines-rewards/:recordId`.
 *
 * Mọi trường tuỳ chọn, kể cả `type`. Gửi `amount: 0` hoặc `null` để xoá số tiền.
 */
export class UpdateDisciplineRewardDto extends PartialType(
  CreateDisciplineRewardDto,
) {}
