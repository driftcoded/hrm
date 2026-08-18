import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { EmployeeStatus, Gender } from '../entities/employee.entity';

/**
 * Cột được phép sắp xếp. Whitelist bằng type + `@IsIn` để giá trị `sort` KHÔNG
 * bao giờ được nội suy tự do vào SQL (CLAUDE.md §Bảo mật).
 */
export const EMPLOYEE_SORT_KEYS = [
  'employeeCode',
  'fullName',
  'hireDate',
  'status',
  'createdAt',
] as const;

export type EmployeeSortKey = (typeof EMPLOYEE_SORT_KEYS)[number];

export class FilterEmployeeDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: EMPLOYEE_SORT_KEYS,
    default: 'employeeCode',
  })
  @IsOptional()
  @IsIn(EMPLOYEE_SORT_KEYS)
  sort?: EmployeeSortKey = 'employeeCode';

  // `search` kế thừa từ PaginationDto — với nhân viên nó tìm trên họ tên,
  // mã NV, email và CCCD (api-spec.md §3), xem EmployeesRepository.

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  positionId?: number;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsCalendarDate()
  hireFrom?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsCalendarDate()
  hireTo?: string;

  @ApiPropertyOptional({
    description:
      'true → CHỈ trả về hồ sơ đã xoá mềm (màn hình "thùng rác" để khôi phục). Mặc định danh sách không bao giờ chứa hồ sơ đã xoá.',
  })
  @IsOptional()
  @IsBooleanValue()
  onlyDeleted?: boolean;
}
