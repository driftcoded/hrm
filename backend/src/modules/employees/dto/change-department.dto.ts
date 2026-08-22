import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

/** Trần số hồ sơ mỗi lần chuyển — chặn một request lỡ gửi cả bảng. */
export const MAX_DEPARTMENT_MOVE = 200;

/**
 * Body của `PATCH /employees/department`.
 *
 * `positionId` BẮT BUỘC chứ không phải tuỳ chọn: `positions.department_id` là
 * cột bắt buộc, nên đổi phòng ban mà giữ chức vụ cũ sẽ để lại nhân viên mang
 * chức vụ của phòng khác — đúng thứ `POSITION_DEPARTMENT_MISMATCH` đang chặn ở
 * luồng sửa từng hồ sơ.
 */
export class ChangeDepartmentDto {
  @ApiProperty({
    example: [51, 52],
    description: `Nhân viên cần chuyển. Tối đa ${MAX_DEPARTMENT_MOVE} hồ sơ mỗi lần.`,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(MAX_DEPARTMENT_MOVE)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  employeeIds: number[];

  @ApiProperty({ example: 3, description: 'Phòng ban đích.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId: number;

  @ApiProperty({
    example: 9,
    description: 'Chức vụ mới, PHẢI thuộc `departmentId`.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  positionId: number;
}

/** Phòng ban bị bỏ lại với trưởng phòng vừa chuyển đi. */
export class OrphanedDepartmentDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Phòng Kỹ thuật' })
  name: string;
}

/**
 * Kết quả `PATCH /employees/department`.
 *
 * `orphanedDepartments` là cảnh báo, không phải lỗi: việc chuyển vẫn diễn ra,
 * nhưng người thao tác cần biết mình vừa để một phòng ban không còn trưởng
 * phòng đứng trong đó.
 */
export class ChangeDepartmentResultDto {
  @ApiProperty({ example: 12 })
  updated: number;

  @ApiProperty({ example: 12, description: 'Số hồ sơ được chọn.' })
  requested: number;

  @ApiProperty({ type: [OrphanedDepartmentDto] })
  orphanedDepartments: OrphanedDepartmentDto[];
}
