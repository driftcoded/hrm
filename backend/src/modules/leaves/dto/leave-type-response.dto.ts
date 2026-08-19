import { ApiProperty } from '@nestjs/swagger';
import { LeaveApplicableGender } from '../entities/leave-type.entity';

/** Shape trả về của `/leave-types` (api-spec.md §8 + toàn bộ cột policy §5.2). */
export class LeaveTypeResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'ANNUAL' })
  code: string;

  @ApiProperty({ example: 'Nghỉ phép năm' })
  name: string;

  @ApiProperty({ example: 12, description: '0 = không giới hạn / theo case' })
  daysPerYear: number;

  @ApiProperty({ example: true })
  isPaid: boolean;

  @ApiProperty({ example: true })
  requireApproval: boolean;

  @ApiProperty({ example: 0.5 })
  minDays: number;

  @ApiProperty({ example: null, nullable: true, type: Number })
  maxConsecutive: number | null;

  @ApiProperty({ example: 3 })
  advanceNoticeDays: number;

  @ApiProperty({
    enum: LeaveApplicableGender,
    example: LeaveApplicableGender.ALL,
  })
  applicableGender: LeaveApplicableGender;

  @ApiProperty({
    example: 'Điều 113 BLLĐ 2019',
    nullable: true,
    type: String,
  })
  description: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty({
    example: false,
    description:
      'Informational only: true = statutory type seeded from Vietnamese labor law, so the UI can mark it as legally mandated. It grants no protection — the only delete guard is LEAVE_TYPE_IN_USE (a type referenced by leave requests/balances). Codes are server-generated and immutable for every type.',
  })
  isSystem: boolean;
}
