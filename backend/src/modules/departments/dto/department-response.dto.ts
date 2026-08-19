import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Department manager – only the fields needed by the UI, does NOT expose the full employee record. */
export class DepartmentManagerDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Trần Thị Nhân Sự' })
  fullName: string;
}

/**
 * Response shape for `/departments` (api-spec.md §4).
 * Does NOT include `deleted_at` (architecture.md §5).
 */
export class DepartmentResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'HR' })
  code: string;

  @ApiProperty({ example: 'Phòng Nhân sự' })
  name: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  description: string | null;

  @ApiProperty({ example: null, nullable: true, type: Number })
  parentId: number | null;

  @ApiProperty({ type: DepartmentManagerDto, nullable: true })
  manager: DepartmentManagerDto | null;

  @ApiProperty({
    example: 5,
    description:
      'Số nhân viên đang trỏ tới phòng ban (mọi bản ghi chưa bị xoá mềm, kể cả đã nghỉ việc)',
  })
  employeeCount: number;

  @ApiProperty({
    example: 4,
    description: 'Số chức vụ được định nghĩa trong phòng ban',
  })
  positionCount: number;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  updatedAt: string;
}

/** A node of the department tree (`GET /departments/tree`). */
export class DepartmentTreeNodeDto extends DepartmentResponseDto {
  @ApiPropertyOptional({
    type: () => [DepartmentTreeNodeDto],
    description: 'Phòng ban con, sắp xếp theo sortOrder rồi name',
  })
  children: DepartmentTreeNodeDto[];
}
