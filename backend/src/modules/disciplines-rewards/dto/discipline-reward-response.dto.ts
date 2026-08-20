import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisciplineRewardType } from '../entities/discipline-reward.entity';

export class DisciplineRewardIssuerDto {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 'Trần Thị Giám Đốc' })
  fullName: string;
}

export class DisciplineRewardResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ enum: DisciplineRewardType })
  type: DisciplineRewardType;

  @ApiProperty({ example: 'Thưởng KPI' })
  category: string;

  @ApiProperty({ example: 'Hoàn thành xuất sắc Q1/2026' })
  title: string;

  @ApiProperty({ example: 'Vượt KPI 120%' })
  description: string;

  @ApiPropertyOptional({ example: 'QD-2026-001' })
  decisionNumber: string | null;

  @ApiProperty({ example: '2026-04-01' })
  decisionDate: string;

  @ApiProperty({ example: '2026-04-01' })
  effectiveDate: string;

  @ApiPropertyOptional({ type: DisciplineRewardIssuerDto })
  issuedBy: DisciplineRewardIssuerDto | null;

  @ApiPropertyOptional({ example: 'https://.../qd-2026-001.pdf' })
  documentUrl: string | null;

  @ApiPropertyOptional({ example: 'Đã thông báo tới trưởng phòng' })
  note: string | null;

  @ApiProperty({ example: '2026-04-01T02:00:00.000Z' })
  createdAt: string;
}
