import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../entities/user.entity';

/** Vai trò rút gọn nhúng trong response tài khoản. */
export class UserRoleDto {
  @ApiProperty({ example: 5 })
  id: number;

  @ApiProperty({ example: 'employee' })
  name: string;

  @ApiProperty({ example: 'Nhân viên' })
  displayName: string;
}

/**
 * Shape trả về của `/users` (api-spec.md §13).
 * KHÔNG bao giờ chứa `password` — cột đó là `select: false` ở entity và cũng
 * không được map ở đây (CLAUDE.md §Bảo mật).
 */
export class UserResponseDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: 'binh.nguyen' })
  username: string;

  @ApiProperty({ example: 'binh.nguyen@company.com' })
  email: string;

  @ApiProperty({ type: UserRoleDto, nullable: true })
  role: UserRoleDto | null;

  @ApiProperty({ example: 51, nullable: true, type: Number })
  employeeId: number | null;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  createdAt: string;
}

/** `GET /roles` — danh sách vai trò để đổ dropdown khi tạo tài khoản. */
export class RoleResponseDto {
  @ApiProperty({ example: 5 })
  id: number;

  @ApiProperty({ example: 'employee' })
  name: string;

  @ApiProperty({ example: 'Nhân viên' })
  displayName: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  description: string | null;
}
