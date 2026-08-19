import { ApiProperty } from '@nestjs/swagger';
import {
  OvertimeRateType,
  OvertimeRequestStatus,
} from '../entities/overtime-request.entity';

/** Nhân viên rút gọn nhúng trong response đơn làm thêm. */
export class OvertimeEmployeeDto {
  @ApiProperty({ example: 51 })
  id: number;

  @ApiProperty({ example: 'NV0051' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Văn Bình' })
  fullName: string;

  @ApiProperty({ example: 'Phòng Kỹ thuật', nullable: true, type: String })
  departmentName: string | null;
}

/** Shape trả về của `/overtime-requests`. */
export class OvertimeResponseDto {
  @ApiProperty({ example: 77 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ type: OvertimeEmployeeDto, nullable: true })
  employee: OvertimeEmployeeDto | null;

  @ApiProperty({ example: '2026-05-25' })
  workDate: string;

  @ApiProperty({ example: '18:00' })
  startTime: string;

  @ApiProperty({ example: '21:00' })
  endTime: string;

  @ApiProperty({ example: 3 })
  totalHours: number;

  @ApiProperty({ example: 0, description: 'Phần giờ rơi vào khung 22h–6h.' })
  nightHours: number;

  @ApiProperty({ enum: OvertimeRateType })
  rateType: OvertimeRateType;

  @ApiProperty({
    example: 1.5,
    description: 'Hệ số Điều 98 đã chốt tại thời điểm tạo đơn.',
  })
  rate: number;

  @ApiProperty({
    example: 0,
    description:
      'Phụ trội ca đêm (0 hoặc 0.3), cộng vào `rate` cho riêng phần `nightHours`.',
  })
  nightRateSurcharge: number;

  @ApiProperty({ example: 'Xử lý sự cố hệ thống thanh toán' })
  reason: string;

  @ApiProperty({
    example: 12,
    nullable: true,
    type: Number,
    description:
      'Người GHI NHẬN đơn (quản lý/nhân sự nhập hộ). `null` với các đơn tạo trước khi có cột này.',
  })
  recordedBy: number | null;

  @ApiProperty({ example: 'Lê Văn Trưởng Nhóm', nullable: true, type: String })
  recorderName: string | null;

  @ApiProperty({ enum: OvertimeRequestStatus })
  status: OvertimeRequestStatus;

  @ApiProperty({ example: null, nullable: true, type: Number })
  approvedBy: number | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  approverName: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  approvedAt: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  rejectedReason: string | null;

  @ApiProperty({ example: '2026-05-20T02:10:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-21T03:00:00.000Z' })
  updatedAt: string;
}
