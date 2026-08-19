import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateContractDto } from './create-contract.dto';

/**
 * `PATCH /contracts/:id` – partial update.
 *
 * `employeeId` bị loại bỏ: chuyển hợp đồng sang nhân viên khác là hành vi
 * không có trong nghiệp vụ (mỗi hợp đồng gắn với một người ký). Muốn sửa thì
 * huỷ hợp đồng và ký hợp đồng mới.
 *
 * Chấm dứt hợp đồng KHÔNG làm ở đây mà qua `PATCH /contracts/:id/terminate`
 * (api-spec.md §6) để `terminated_date` / `terminated_reason` / `status` luôn
 * được đặt cùng nhau.
 */
export class UpdateContractDto extends PartialType(
  OmitType(CreateContractDto, ['employeeId'] as const),
) {}
