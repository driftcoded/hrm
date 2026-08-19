import { ApiProperty } from '@nestjs/swagger';
import { FamilyRelationship } from '../entities/family-member.entity';

/** Shape trả về của `/employees/:id/family-members` (api-spec.md §10). */
export class FamilyMemberResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ example: 'Nguyễn Thị Vợ' })
  fullName: string;

  @ApiProperty({ enum: FamilyRelationship })
  relationship: FamilyRelationship;

  @ApiProperty({ example: '1998-03-10', nullable: true, type: String })
  dateOfBirth: string | null;

  @ApiProperty({ example: 'Giáo viên', nullable: true, type: String })
  occupation: string | null;

  @ApiProperty({ example: '0912345678', nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  cccdNumber: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  note: string | null;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  updatedAt: string;
}
