import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import {
  IsCccdNumber,
  IsTaxCode,
  IsVnPersonName,
} from '@/common/validators/vn-identity.validator';
import { DependentRelationship } from '../entities/dependent.entity';

/**
 * `POST /employees/:id/dependents` (api-spec.md §11).
 *
 * `status` / `reasonInactive` KHÔNG có ở đây: người phụ thuộc lúc đăng ký luôn
 * là `active` — chuyển sang `inactive` là một sự kiện về sau (có thu nhập, quá
 * tuổi, qua đời) và đi qua PATCH kèm lý do.
 */
export class CreateDependentDto {
  @ApiProperty({ example: 'Nguyễn Thị Mẹ', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsVnPersonName()
  fullName: string;

  @ApiProperty({
    enum: DependentRelationship,
    example: DependentRelationship.PARENT,
  })
  @IsEnum(DependentRelationship)
  relationship: DependentRelationship;

  @ApiProperty({
    example: '1960-04-15',
    description: 'Bắt buộc – dùng để xác định điều kiện giảm trừ theo độ tuổi',
  })
  @IsCalendarDate()
  dateOfBirth: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsCccdNumber()
  cccdNumber?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsTaxCode()
  taxCode?: string | null;

  @ApiProperty({
    example: '2026-01-01',
    description: 'Ngày bắt đầu được tính giảm trừ gia cảnh',
  })
  @IsCalendarDate()
  registrationDate: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Ngày hết giảm trừ; để trống khi vẫn đang được tính',
  })
  @IsOptional()
  @IsCalendarDate()
  endDate?: string | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    maxLength: 500,
    description: 'Link giấy tờ chứng minh trên S3',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentUrl?: string | null;

  @ApiPropertyOptional({
    example: 'Mẹ ruột, không có thu nhập',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  note?: string | null;
}
