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
  IsVnPersonName,
  IsVnPhone,
} from '@/common/validators/vn-identity.validator';
import { FamilyRelationship } from '../entities/family-member.entity';

/** `POST /employees/:id/family-members` (api-spec.md §10). */
export class CreateFamilyMemberDto {
  @ApiProperty({ example: 'Nguyễn Văn Con', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsVnPersonName()
  fullName: string;

  @ApiProperty({ enum: FamilyRelationship, example: FamilyRelationship.CHILD })
  @IsEnum(FamilyRelationship)
  relationship: FamilyRelationship;

  @ApiPropertyOptional({ example: '2020-08-15', nullable: true })
  @IsOptional()
  @IsCalendarDate()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ example: 'Giáo viên', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string | null;

  @ApiPropertyOptional({ example: '0912345678', nullable: true })
  @IsOptional()
  @IsVnPhone()
  phone?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsCccdNumber()
  cccdNumber?: string | null;

  @ApiPropertyOptional({ example: '', nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;
}
