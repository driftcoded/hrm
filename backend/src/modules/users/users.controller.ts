import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ROLE_ADMIN } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { RoleResponseDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

/**
 * `POST /users` (api-spec.md §13) — chỉ `admin`, đúng ma trận phân quyền
 * `architecture.md` §7.3 ("Quản lý user: admin ✅, còn lại ❌").
 *
 * Đây là API cho bước 4 ("tài khoản") của wizard tạo nhân viên: hồ sơ nhân viên
 * (`employees`) và tài khoản đăng nhập (`users`) là hai bản ghi tách rời, nối
 * qua `users.employee_id`.
 *
 * Phạm vi CỐ Ý hẹp: chưa có `GET /users`, `PATCH /users/:id`,
 * `PATCH /users/:id/reset-password` của api-spec §13 — màn hình quản lý tài
 * khoản chưa nằm trong giai đoạn nào của PLAN, thêm sớm là code không ai gọi.
 */
@ApiTags('Users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('roles')
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách vai trò đang hoạt động',
    description:
      'Đổ dropdown khi tạo tài khoản. Mọi role đã đăng nhập đọc được — chỉ là tên vai trò, không phải dữ liệu nhạy cảm.',
  })
  @ApiOkResponse({ type: [RoleResponseDto] })
  findRoles(): Promise<RoleResponseDto[]> {
    return this.usersService.findRoles();
  }

  @Post('users')
  @Roles(ROLE_ADMIN)
  @ApiAuth()
  @ApiOperation({ summary: 'Tạo tài khoản đăng nhập cho một nhân viên' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({
    description:
      'DUPLICATE_USERNAME / DUPLICATE_EMAIL / EMPLOYEE_ALREADY_HAS_ACCOUNT',
  })
  @ApiUnprocessableEntityResponse({ description: 'ROLE_NOT_FOUND' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin' })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }
}
