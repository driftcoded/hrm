import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EducationLevel,
  EmployeeStatus,
  Gender,
  MaritalStatus,
  TerminationType,
} from '../entities/employee.entity';

/** Tham chiếu rút gọn (phòng ban / chức vụ / quản lý trực tiếp). */
export class EmployeeRefDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Phòng Kỹ thuật' })
  name: string;
}

/**
 * Một dòng trong `GET /employees` (api-spec.md §3).
 * Cố tình KHÔNG chứa CCCD/số tài khoản: danh sách là màn hình mở rộng nhất
 * trong app, không cần dữ liệu nhạy cảm để render.
 */
export class EmployeeListItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'NV0001' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Thị Lan' })
  fullName: string;

  @ApiProperty({ example: 'lan.nguyen@company.com' })
  email: string;

  @ApiProperty({ example: '0901234567' })
  phone: string;

  @ApiProperty({ enum: Gender, example: Gender.FEMALE })
  gender: Gender;

  @ApiProperty({ example: '1995-03-15' })
  dateOfBirth: string;

  @ApiProperty({ type: EmployeeRefDto, nullable: true })
  department: EmployeeRefDto | null;

  @ApiProperty({ type: EmployeeRefDto, nullable: true })
  position: EmployeeRefDto | null;

  @ApiProperty({ enum: EmployeeStatus, example: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  @ApiProperty({ example: '2022-01-10' })
  hireDate: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  avatarUrl: string | null;

  @ApiProperty({
    example: 15000000,
    nullable: true,
    type: Number,
    description:
      'Lương cơ bản của hợp đồng đang hiệu lực, VNĐ (api-spec.md §1.5). null = chưa có hợp đồng active.',
  })
  baseSalary: number | null;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    description:
      'Thời điểm xoá mềm – chỉ khác null trong danh sách `?onlyDeleted=true`',
  })
  deletedAt: string | null;
}

/**
 * `GET /employees/:id` — hồ sơ đầy đủ (api-spec.md §3).
 * Vẫn KHÔNG có `deletedAt` ở nhánh dữ liệu thường (architecture.md §5) ngoài
 * field kế thừa dùng cho màn hình khôi phục.
 */
export class EmployeeDetailDto extends EmployeeListItemDto {
  @ApiProperty({ example: 'Nguyễn' })
  lastName: string;

  @ApiProperty({ example: 'Thị Lan' })
  firstName: string;

  @ApiProperty({ enum: MaritalStatus })
  maritalStatus: MaritalStatus;

  @ApiProperty({ example: 'Việt Nam' })
  nationality: string;

  @ApiProperty({ example: 'Kinh' })
  ethnicity: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  religion: string | null;

  @ApiProperty({ example: 'Hà Nội' })
  placeOfBirth: string;

  @ApiProperty({ example: 'Hà Nam' })
  hometown: string;

  @ApiProperty({ example: '001098765432' })
  cccdNumber: string;

  @ApiProperty({ example: '2021-05-10' })
  cccdIssueDate: string;

  @ApiProperty({ example: 'Cục CS QLHC về TTXH Hà Nội' })
  cccdIssuePlace: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  cccdExpiredDate: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  taxCode: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  socialInsuranceNo: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  healthInsuranceNo: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  healthInsuranceExp: string | null;

  @ApiProperty({ example: 'Số 10, Ngõ 20, Phố Huế, Hà Nội' })
  permanentAddress: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  currentAddress: string | null;

  @ApiProperty({ example: '01' })
  provinceCode: string;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    deprecated: true,
    description:
      'Cấp huyện đã bị bỏ từ 01/07/2025 (Luật 72/2025/QH15); chỉ còn giá trị ở hồ sơ cũ',
  })
  districtCode: string | null;

  @ApiProperty({ example: '00193' })
  wardCode: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  personalEmail: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  emergencyContactName: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  emergencyContactPhone: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  emergencyContactRel: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  bankAccount: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  bankName: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  bankBranch: string | null;

  @ApiProperty({ type: EmployeeRefDto, nullable: true })
  directManager: EmployeeRefDto | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  probationStartDate: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  probationEndDate: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  officialStartDate: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  terminationDate: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  terminationReason: string | null;

  @ApiProperty({ enum: TerminationType, nullable: true })
  terminationType: TerminationType | null;

  @ApiProperty({ enum: EducationLevel, nullable: true })
  educationLevel: EducationLevel | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  major: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  university: string | null;

  @ApiProperty({ example: null, nullable: true, type: Number })
  graduationYear: number | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  notes: string | null;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  updatedAt: string;
}

/** Hợp đồng đang hiệu lực, nhúng trong `GET /employees/:id/summary`. */
export class EmployeeSummaryContractDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'HDLD-2026-051' })
  contractNumber: string;

  @ApiProperty({ example: 'fixed_term' })
  contractType: string;

  @ApiProperty({ example: '2026-08-01' })
  startDate: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  endDate: string | null;

  @ApiProperty({ example: 15000000, description: 'VNĐ (api-spec.md §1.5)' })
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
}

/**
 * `GET /employees/:id/summary` — dữ liệu tối thiểu để in phiếu lương
 * (PLAN §3.1). Gom sẵn hợp đồng hiệu lực + số người phụ thuộc để module
 * lương ở Giai đoạn 6 không phải join lại từ đầu.
 */
export class EmployeeSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'NV0001' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Thị Lan' })
  fullName: string;

  @ApiProperty({ enum: EmployeeStatus })
  status: EmployeeStatus;

  @ApiProperty({ type: EmployeeRefDto, nullable: true })
  department: EmployeeRefDto | null;

  @ApiProperty({ type: EmployeeRefDto, nullable: true })
  position: EmployeeRefDto | null;

  @ApiProperty({ example: '2022-01-10' })
  hireDate: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  taxCode: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  socialInsuranceNo: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  bankAccount: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  bankName: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  bankBranch: string | null;

  @ApiProperty({
    example: 1,
    description:
      'Số người phụ thuộc đang có hiệu lực – dùng cho giảm trừ gia cảnh',
  })
  activeDependents: number;

  @ApiPropertyOptional({
    type: EmployeeSummaryContractDto,
    nullable: true,
    description:
      'Hợp đồng status=active mới nhất; null = chưa có hợp đồng hiệu lực (Giai đoạn 6 trả NO_ACTIVE_CONTRACT khi tính lương)',
  })
  activeContract: EmployeeSummaryContractDto | null;
}

/** Body của `POST /employees/:id/avatar` (api-spec.md §3). */
export class AvatarUploadResponseDto {
  @ApiProperty({ example: '/api/v1/uploads/avatars/1/9f2c….jpg' })
  avatarUrl: string;
}

/** Body của `POST /employees/:id/restore`. */
export class RestoreResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: true })
  restored: boolean;
}
