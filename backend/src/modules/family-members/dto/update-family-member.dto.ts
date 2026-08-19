import { PartialType } from '@nestjs/swagger';
import { CreateFamilyMemberDto } from './create-family-member.dto';

/**
 * `PATCH /employees/:id/family-members/:memberId` – partial update.
 * Field vắng mặt = không đổi; gửi `null` = xoá giá trị.
 */
export class UpdateFamilyMemberDto extends PartialType(CreateFamilyMemberDto) {}
