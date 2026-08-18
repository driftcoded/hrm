import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import {
  IsCccdNumber,
  IsHealthInsuranceNo,
  IsSocialInsuranceNo,
  IsTaxCode,
  IsVnPersonName,
  IsVnPhone,
} from '@/common/validators/vn-identity.validator';
import {
  EducationLevel,
  EmployeeStatus,
  Gender,
  MaritalStatus,
} from '../entities/employee.entity';

/** Mã tỉnh/huyện/xã theo Bộ Nội Vụ – chuỗi số, tối đa 10 ký tự (schema §2.3). */
export const AREA_CODE_PATTERN = /^\d{1,10}$/;

/** Số tài khoản ngân hàng: chỉ chữ số, 6–30 ký tự. */
export const BANK_ACCOUNT_PATTERN = /^\d{6,30}$/;

/**
 * Body của `POST /employees` (api-spec.md §3).
 *
 * `employeeCode` KHÔNG nhận từ client — service tự sinh `NV0001`, `NV0002`…
 * `fullName` cũng không nhận: luôn được ghép từ `lastName` + `firstName` để
 * hai cột không bao giờ lệch nhau.
 * `avatarUrl` chỉ đổi qua `POST /employees/:id/avatar`.
 */
export class CreateEmployeeDto {
  // ---------------------------------------------------------- cá nhân ----

  @ApiProperty({ example: 'Nguyễn', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @IsVnPersonName()
  lastName: string;

  @ApiProperty({ example: 'Văn Bình', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @IsVnPersonName()
  firstName: string;

  @ApiProperty({ example: '1998-07-20', description: 'Tuổi hợp lệ: 15–70' })
  @IsCalendarDate()
  dateOfBirth: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender: Gender;

  @ApiPropertyOptional({
    enum: MaritalStatus,
    default: MaritalStatus.SINGLE,
  })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({ example: 'Việt Nam', default: 'Việt Nam' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nationality?: string;

  @ApiPropertyOptional({ example: 'Kinh', default: 'Kinh' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ethnicity?: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'null = Không',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  religion?: string | null;

  @ApiProperty({ example: 'Hà Nội', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  placeOfBirth: string;

  @ApiProperty({ example: 'Hà Nam', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  hometown: string;

  // ------------------------------------------------- giấy tờ tuỳ thân ----

  @ApiProperty({ example: '001098765432', description: 'Đúng 12 chữ số' })
  @IsCccdNumber()
  cccdNumber: string;

  @ApiProperty({ example: '2021-05-10' })
  @IsCalendarDate()
  cccdIssueDate: string;

  @ApiProperty({ example: 'Cục CS QLHC về TTXH Hà Nội', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  cccdIssuePlace: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'CCCD gắn chip mới có hạn dùng; loại cũ để null',
  })
  @IsOptional()
  @IsCalendarDate()
  cccdExpiredDate?: string | null;

  // --------------------------------------------- mã số thuế & bảo hiểm ----

  @ApiPropertyOptional({ example: '8901234560', nullable: true })
  @IsOptional()
  @IsTaxCode()
  taxCode?: string | null;

  @ApiPropertyOptional({ example: '0123456789', nullable: true })
  @IsOptional()
  @IsSocialInsuranceNo()
  socialInsuranceNo?: string | null;

  @ApiPropertyOptional({ example: 'DN4010000123456', nullable: true })
  @IsOptional()
  @IsHealthInsuranceNo()
  healthInsuranceNo?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsCalendarDate()
  healthInsuranceExp?: string | null;

  // ---------------------------------------------------------- địa chỉ ----

  @ApiProperty({
    example: 'Số 10, Ngõ 20, Phố Huế, Hai Bà Trưng, Hà Nội',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  permanentAddress: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'null = giống thường trú',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  currentAddress?: string | null;

  @ApiProperty({ example: '01', maxLength: 10 })
  @IsString()
  @Matches(AREA_CODE_PATTERN, { message: 'provinceCode must be 1-10 digits' })
  provinceCode: string;

  @ApiProperty({ example: '007', maxLength: 10 })
  @IsString()
  @Matches(AREA_CODE_PATTERN, { message: 'districtCode must be 1-10 digits' })
  districtCode: string;

  @ApiProperty({ example: '00193', maxLength: 10 })
  @IsString()
  @Matches(AREA_CODE_PATTERN, { message: 'wardCode must be 1-10 digits' })
  wardCode: string;

  // --------------------------------------------------------- liên lạc ----

  @ApiProperty({ example: '0912345678' })
  @IsVnPhone()
  phone: string;

  @ApiProperty({ example: 'binh.nguyen@company.com', maxLength: 100 })
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  personalEmail?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactName?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsVnPhone()
  emergencyContactPhone?: string | null;

  @ApiPropertyOptional({ example: 'Vợ', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactRel?: string | null;

  // -------------------------------------------------------- ngân hàng ----

  @ApiPropertyOptional({ example: '1234567890', nullable: true })
  @IsOptional()
  @Matches(BANK_ACCOUNT_PATTERN, {
    message: 'bankAccount must be 6-30 digits',
  })
  bankAccount?: string | null;

  @ApiPropertyOptional({ example: 'Vietcombank', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string | null;

  @ApiPropertyOptional({ example: 'Chi nhánh Hà Nội', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankBranch?: string | null;

  // ----------------------------------------------------- công việc ----

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  positionId: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  directManagerId?: number | null;

  @ApiProperty({ example: '2026-06-01' })
  @IsCalendarDate()
  hireDate: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsCalendarDate()
  probationStartDate?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsCalendarDate()
  probationEndDate?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsCalendarDate()
  officialStartDate?: string | null;

  @ApiPropertyOptional({
    enum: EmployeeStatus,
    default: EmployeeStatus.PROBATION,
    description:
      'Trạng thái nghỉ việc (resigned/terminated) chỉ đặt qua PATCH kèm termination*',
  })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  // ---------------------------------------------------------- học vấn ----

  @ApiPropertyOptional({ enum: EducationLevel, nullable: true })
  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel | null;

  @ApiPropertyOptional({ example: 'Công nghệ thông tin', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  major?: string | null;

  @ApiPropertyOptional({
    example: 'Đại học Bách Khoa Hà Nội',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  university?: string | null;

  @ApiPropertyOptional({ example: 2020, nullable: true, minimum: 1950 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  graduationYear?: number | null;

  // --------------------------------------------------------- metadata ----

  @ApiPropertyOptional({ example: '', nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
