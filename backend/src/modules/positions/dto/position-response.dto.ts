import { ApiProperty } from '@nestjs/swagger';

/** Abbreviated department embedded in the position response (api-spec.md §5). */
export class PositionDepartmentDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Phòng Kỹ thuật' })
  name: string;
}

export class PositionResponseDto {
  @ApiProperty({ example: 3 })
  id: number;

  @ApiProperty({ example: 'DEV_SENIOR' })
  code: string;

  @ApiProperty({ example: 'Developer Senior' })
  name: string;

  @ApiProperty({
    type: PositionDepartmentDto,
    nullable: true,
    description:
      'null chỉ xảy ra nếu phòng ban đã bị xoá mềm — bình thường không thể vì DELETE /departments/:id chặn khi còn chức vụ',
  })
  department: PositionDepartmentDto | null;

  @ApiProperty({ example: 2 })
  level: number;

  @ApiProperty({
    example: 20000000,
    nullable: true,
    type: Number,
    description: 'VNĐ dạng number (api-spec.md §1.5)',
  })
  minSalary: number | null;

  @ApiProperty({ example: 35000000, nullable: true, type: Number })
  maxSalary: number | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  description: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  updatedAt: string;
}
