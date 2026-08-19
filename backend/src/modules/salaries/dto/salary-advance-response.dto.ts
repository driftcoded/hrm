import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalaryAdvanceStatus } from '../entities/salary-advance.entity';

export class SalaryAdvanceEmployeeDto {
  @ApiProperty({ example: 51 })
  id: number;

  @ApiProperty({ example: 'NV0051' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Văn Bình' })
  fullName: string;

  @ApiPropertyOptional({ example: 'Phòng Kỹ thuật' })
  departmentName: string | null;
}

export class SalaryAdvanceResponseDto {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ type: SalaryAdvanceEmployeeDto })
  employee: SalaryAdvanceEmployeeDto;

  @ApiProperty({ example: 5000000 })
  amount: number;

  @ApiProperty({ example: '2026-08-20' })
  advanceDate: string;

  @ApiProperty({ example: 9 })
  deductMonth: number;

  @ApiProperty({ example: 2026 })
  deductYear: number;

  @ApiProperty({ example: 'Ứng trước tiền viện phí' })
  reason: string;

  @ApiProperty({ enum: SalaryAdvanceStatus })
  status: SalaryAdvanceStatus;

  @ApiPropertyOptional({ example: null })
  rejectedReason: string | null;

  @ApiPropertyOptional({ example: 12 })
  recordedBy: number | null;

  @ApiPropertyOptional({ example: 'Lê Văn Trưởng Nhóm' })
  recorderName: string | null;

  @ApiPropertyOptional({ example: 'Trần Thị Nhân Sự' })
  approverName: string | null;

  @ApiPropertyOptional({ example: '2026-08-21T02:00:00.000Z' })
  approvedAt: string | null;

  @ApiProperty({ example: '2026-08-20T02:00:00.000Z' })
  createdAt: string;
}
