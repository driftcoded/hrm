import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { DisciplineRewardType } from '../entities/discipline-reward.entity';

/**
 * Body của `POST /employees/:employeeId/disciplines-rewards`.
 *
 * `employeeId` lấy từ đường dẫn. `decisionDate` là ngày ký, `effectiveDate` là
 * ngày có hiệu lực — hai mốc khác nhau, cả hai đều bắt buộc.
 */
export class CreateDisciplineRewardDto {
  @ApiProperty({ enum: DisciplineRewardType })
  @IsEnum(DisciplineRewardType)
  type: DisciplineRewardType;

  @ApiProperty({
    example: 'Khiển trách',
    description:
      'Hình thức cụ thể. Với kỷ luật, Điều 124 BLLĐ 2019 chỉ có ba mức: khiển trách; kéo dài thời hạn nâng lương / cách chức; sa thải.',
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  category: string;

  @ApiProperty({ example: 'Vi phạm nội quy công ty', maxLength: 255 })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Đi muộn liên tục 3 ngày trong tháng 5/2026' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ example: 'QD-KC-2026-005', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  decisionNumber?: string;

  @ApiProperty({ example: '2026-05-20', description: 'Ngày ký quyết định.' })
  @IsCalendarDate()
  decisionDate: string;

  @ApiProperty({
    example: '2026-06-01',
    description: 'Ngày quyết định có hiệu lực.',
  })
  @IsCalendarDate()
  effectiveDate: string;

  @ApiPropertyOptional({
    example: 5000000,
    description:
      'CHỈ dùng cho khen thưởng. Điều 128 BLLĐ 2019 CẤM phạt tiền và cấm trừ lương thay cho kỷ luật, nên gửi kèm `type = discipline` sẽ bị từ chối.',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Người ký quyết định (`employees.id`).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  issuedById?: number;

  @ApiPropertyOptional({ example: 'https://.../qd-kc-2026-005.pdf' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  documentUrl?: string;

  @ApiPropertyOptional({ example: 'Đã thông báo tới trưởng phòng' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
