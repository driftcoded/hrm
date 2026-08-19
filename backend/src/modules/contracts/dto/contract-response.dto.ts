import { ApiProperty } from '@nestjs/swagger';
import { ContractStatus, ContractType } from '../entities/contract.entity';

/** Nhân viên rút gọn nhúng trong response hợp đồng. */
export class ContractEmployeeDto {
  @ApiProperty({ example: 51 })
  id: number;

  @ApiProperty({ example: 'NV0051' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Văn Bình' })
  fullName: string;
}

/**
 * Shape trả về của `/contracts` (api-spec.md §6).
 * Mọi cột DECIMAL được trả về dạng `number` VNĐ (api-spec.md §1.5) — mysql2
 * trả DECIMAL dưới dạng string nên phải ép kiểu ở tầng service.
 */
export class ContractResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ type: ContractEmployeeDto, nullable: true })
  employee: ContractEmployeeDto | null;

  @ApiProperty({ example: 'HDLD-2026-051' })
  contractNumber: string;

  @ApiProperty({ enum: ContractType })
  contractType: ContractType;

  @ApiProperty({ example: '2026-08-01' })
  startDate: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  endDate: string | null;

  @ApiProperty({ example: '2026-07-28' })
  signDate: string;

  @ApiProperty({ example: 15000000 })
  baseSalary: number;

  @ApiProperty({ example: 15000000 })
  insuranceSalary: number;

  @ApiProperty({ example: 500000 })
  positionAllowance: number;

  @ApiProperty({ example: 0 })
  otherAllowance: number;

  @ApiProperty({ example: 8 })
  workingHours: number;

  @ApiProperty({ example: 5 })
  workingDays: number;

  @ApiProperty({ example: 85, nullable: true, type: Number })
  probationSalaryPct: number | null;

  @ApiProperty({ enum: ContractStatus })
  status: ContractStatus;

  @ApiProperty({ example: null, nullable: true, type: String })
  terminatedDate: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  terminatedReason: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  fileUrl: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  note: string | null;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  updatedAt: string;
}
