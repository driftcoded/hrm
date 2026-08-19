import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { ContractStatus, ContractType } from '../entities/contract.entity';

/** `contracts.contract_number` là VARCHAR(50) UNIQUE (schema §4.1). */
export const CONTRACT_NUMBER_PATTERN = /^[A-Za-z0-9/_-]{3,50}$/;

/** Tiền VNĐ: DECIMAL(15,2) → tối đa 9_999_999_999_999.99 (schema §4.1). */
export const MAX_MONEY = 9_999_999_999_999;

/**
 * `POST /contracts` (api-spec.md §6).
 *
 * Tiền gửi lên dạng number theo api-spec.md §1.5 (không phải chuỗi
 * `"15,000,000"`); service ép về chuỗi DECIMAL trước khi ghi DB.
 */
export class CreateContractDto {
  @ApiProperty({ example: 51 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId: number;

  @ApiProperty({ example: 'HDLD-2026-051', maxLength: 50 })
  @IsString()
  @Matches(CONTRACT_NUMBER_PATTERN, {
    message:
      'contractNumber must be 3-50 characters of letters, digits, "-", "_" or "/"',
  })
  contractNumber: string;

  @ApiProperty({ enum: ContractType, example: ContractType.FIXED_TERM })
  @IsEnum(ContractType)
  contractType: ContractType;

  @ApiProperty({ example: '2026-08-01' })
  @IsCalendarDate()
  startDate: string;

  @ApiPropertyOptional({
    example: '2027-07-31',
    nullable: true,
    description: 'Bắt buộc trừ loại indefinite (schema §4.1)',
  })
  @IsOptional()
  @IsCalendarDate()
  endDate?: string | null;

  @ApiProperty({ example: '2026-07-28' })
  @IsCalendarDate()
  signDate: string;

  @ApiProperty({ example: 15000000, description: 'VNĐ (api-spec.md §1.5)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  baseSalary: number;

  @ApiProperty({ example: 15000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  insuranceSalary: number;

  @ApiPropertyOptional({ example: 500000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  positionAllowance?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  otherAllowance?: number;

  @ApiPropertyOptional({ example: 8, default: 8, minimum: 1, maximum: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(24)
  workingHours?: number;

  @ApiPropertyOptional({ example: 5, default: 5, minimum: 1, maximum: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  workingDays?: number;

  @ApiPropertyOptional({
    example: 85,
    default: 85,
    minimum: 85,
    maximum: 100,
    description:
      '% lương thử việc – Điều 26 BLLĐ 2019 quy định tối thiểu 85% lương của công việc đó',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(85)
  @Max(100)
  probationSalaryPct?: number | null;

  @ApiPropertyOptional({
    enum: ContractStatus,
    default: ContractStatus.DRAFT,
    description:
      'Chỉ nhận draft hoặc active lúc tạo; expired/terminated là kết quả của vòng đời hợp đồng',
  })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ example: null, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  note?: string | null;
}
