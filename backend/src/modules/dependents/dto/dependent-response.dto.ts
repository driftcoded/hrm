import { ApiProperty } from '@nestjs/swagger';
import {
  DependentRelationship,
  DependentStatus,
} from '../entities/dependent.entity';

/** Shape trả về của `/employees/:id/dependents` (api-spec.md §11). */
export class DependentResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ example: 'Nguyễn Thị Mẹ' })
  fullName: string;

  @ApiProperty({ enum: DependentRelationship })
  relationship: DependentRelationship;

  @ApiProperty({ example: '1960-04-15' })
  dateOfBirth: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  cccdNumber: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  taxCode: string | null;

  @ApiProperty({ example: '2026-01-01' })
  registrationDate: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  endDate: string | null;

  @ApiProperty({ enum: DependentStatus })
  status: DependentStatus;

  @ApiProperty({ example: null, nullable: true, type: String })
  reasonInactive: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  documentUrl: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  note: string | null;

  @ApiProperty({
    example: true,
    description:
      'Có được tính giảm trừ tại thời điểm gọi API hay không: status=active VÀ hôm nay nằm trong [registrationDate, endDate]. Giai đoạn 6 tính lương theo TỪNG THÁNG nên KHÔNG dùng cờ này thay cho phép tính của mình — đây chỉ là thông tin cho UI.',
  })
  isCurrentlyDeductible: boolean;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  updatedAt: string;
}
