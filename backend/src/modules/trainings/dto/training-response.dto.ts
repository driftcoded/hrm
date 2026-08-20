import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingResult } from '../entities/employee-training.entity';
import { TrainingStatus, TrainingType } from '../entities/training.entity';

export class TrainingResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'TRN-2026-001' })
  code: string;

  @ApiProperty({ example: 'Kỹ năng lãnh đạo' })
  name: string;

  @ApiProperty({ enum: TrainingType })
  type: TrainingType;

  @ApiPropertyOptional({ example: 'Khoá 3 ngày cho cấp quản lý' })
  description: string | null;

  @ApiPropertyOptional({ example: '2026-06-10' })
  startDate: string | null;

  @ApiPropertyOptional({ example: '2026-06-12' })
  endDate: string | null;

  @ApiPropertyOptional({ example: 'Hà Nội' })
  location: string | null;

  @ApiPropertyOptional({ example: 'Học viện Kỹ năng PACE' })
  trainer: string | null;

  @ApiProperty({ example: 5000000 })
  cost: number;

  @ApiPropertyOptional({ example: 20, description: '`null` = không giới hạn.' })
  maxParticipants: number | null;

  @ApiProperty({
    example: 12,
    description: 'Số người đã ghi danh — để biết còn bao nhiêu chỗ.',
  })
  participantCount: number;

  @ApiProperty({ enum: TrainingStatus })
  status: TrainingStatus;

  @ApiPropertyOptional({ example: 'https://.../ke-hoach-dao-tao.pdf' })
  attachmentUrl: string | null;

  @ApiPropertyOptional({ example: 'Ngân sách đã duyệt theo QĐ-2026-018' })
  note: string | null;

  @ApiProperty({ example: '2026-05-01T02:00:00.000Z' })
  createdAt: string;
}

export class TrainingBriefDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'TRN-2026-001' })
  code: string;

  @ApiProperty({ example: 'Kỹ năng lãnh đạo' })
  name: string;

  @ApiProperty({ enum: TrainingType })
  type: TrainingType;

  @ApiPropertyOptional({ example: '2026-06-10' })
  startDate: string | null;

  @ApiPropertyOptional({ example: '2026-06-12' })
  endDate: string | null;
}

export class TrainingParticipantDto {
  @ApiProperty({ example: 15 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ example: 'NV0051' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Văn Bình' })
  fullName: string;

  @ApiPropertyOptional({ example: 'Phòng Kỹ thuật' })
  departmentName: string | null;

  @ApiProperty({ example: '2026-05-20' })
  registrationDate: string;

  @ApiPropertyOptional({ example: '2026-06-12' })
  completionDate: string | null;

  @ApiPropertyOptional({ enum: TrainingResult })
  result: TrainingResult | null;

  @ApiPropertyOptional({ example: 8.5 })
  score: number | null;

  @ApiPropertyOptional({ example: 'https://.../chung-chi-nv0051.pdf' })
  certificateUrl: string | null;

  @ApiPropertyOptional({ example: 'Vắng buổi 2, đã học bù' })
  note: string | null;

  /**
   * Chỉ có ở `GET /employees/:id/trainings`, nơi câu hỏi là "học khoá nào".
   *
   * `TrainingBriefDto` phải khai báo TRƯỚC class này: `emitDecoratorMetadata`
   * sinh `design:type` đọc thẳng biến lúc định nghĩa class, nên khai báo sau sẽ
   * ném `Cannot access ... before initialization` khi Nest nạp module.
   */
  @ApiPropertyOptional({ type: () => TrainingBriefDto })
  training?: TrainingBriefDto;
}

/** Kết quả `POST /trainings/:id/participants` — ghi danh hàng loạt. */
export class EnrollResultDto {
  @ApiProperty({ example: 18, description: 'Số người vừa được ghi danh.' })
  enrolled: number;

  @ApiProperty({
    example: ['NV0051'],
    type: [String],
    description: 'Người ĐÃ có trong khoá từ trước nên bị bỏ qua.',
  })
  alreadyEnrolled: string[];
}
