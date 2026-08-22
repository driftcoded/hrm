import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  EMPLOYEE_DELETE_ROLES,
  EMPLOYEE_WRITE_ROLES,
} from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { DeleteResponseDto } from '@/common/dto/delete-response.dto';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { UploadedFileLike } from '@/shared/storage/image-file.util';
import {
  ChangeDepartmentDto,
  ChangeDepartmentResultDto,
} from './dto/change-department.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import {
  AvatarUploadResponseDto,
  EmployeeDetailDto,
  EmployeeListItemDto,
  EmployeeSummaryDto,
  RestoreResponseDto,
} from './dto/employee-response.dto';
import { EmployeeStatsDto } from './dto/employee-stats.dto';
import { FilterEmployeeDto } from './dto/filter-employee.dto';
import {
  SendEmployeeEmailDto,
  SendEmployeeEmailResultDto,
} from './dto/send-employee-email.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

/**
 * Trần cứng của multer, KHÔNG phải giới hạn nghiệp vụ.
 *
 * Giới hạn thật (mặc định 2MB, `AVATAR_MAX_BYTES`) do StorageService kiểm tra
 * để trả `400 AVATAR_TOO_LARGE` đúng format api-spec.md. Trần này chỉ để một
 * request khổng lồ không nuốt hết RAM trước khi tới được tầng service.
 */
export const AVATAR_MULTER_HARD_LIMIT_BYTES = 10 * 1024 * 1024;

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module).
 *
 * Phân quyền ĐỌC không khai báo `@Roles()`: phạm vi dữ liệu phụ thuộc phòng
 * ban của từng bản ghi (architecture.md §7.3 – manager chỉ thấy phòng ban
 * mình) nên chỉ quyết định được ở tầng service, không quyết định được bằng
 * role. Ghi/xoá thì thuần theo role nên chặn ngay ở đây.
 */
@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách nhân viên (phân trang + filter)',
    description:
      '`search` tìm trên họ tên, mã NV, email, CCCD. limit tối đa 100 (api-spec.md §1.2). ' +
      'admin/hr_manager/hr_staff thấy toàn bộ; manager chỉ thấy nhân viên phòng ban mình; ' +
      'role employee bị từ chối 403 và phải dùng GET /employees/me.',
  })
  @ApiOkResponse({ type: [EmployeeListItemDto] })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN – role không được xem danh sách',
  })
  findAll(
    @Query() filter: FilterEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<EmployeeListItemDto>> {
    return this.employeesService.findAll(filter, user);
  }

  // Phải đứng TRƯỚC `:id`, nếu không "me" sẽ bị ParseIntPipe bắt và trả 400.
  @Get('me')
  @ApiAuth()
  @ApiOperation({ summary: 'Hồ sơ của chính tài khoản đang đăng nhập' })
  @ApiOkResponse({ type: EmployeeDetailDto })
  @ApiNotFoundResponse({
    description: 'EMPLOYEE_NOT_FOUND – tài khoản chưa gắn hồ sơ nhân viên',
  })
  findMe(@CurrentUser() user: AuthenticatedUser): Promise<EmployeeDetailDto> {
    return this.employeesService.findMe(user);
  }

  // Cũng phải đứng TRƯỚC `:id` — xem ghi chú ở `me`.
  @Get('stats')
  @ApiAuth()
  @ApiOperation({
    summary: 'Số liệu tổng quan nhân sự cho màn hình danh sách',
    description:
      'Gộp mọi con số của các thẻ tổng quan + panel bên phải vào MỘT request. ' +
      'Tính trong đúng phạm vi của role gọi nó (manager chỉ thấy phòng ban mình). ' +
      'KHÔNG có số liệu "so với tháng trước": bảng employees chỉ lưu trạng thái hiện tại.',
  })
  @ApiOkResponse({ type: EmployeeStatsDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được xem' })
  findStats(@CurrentUser() user: AuthenticatedUser): Promise<EmployeeStatsDto> {
    return this.employeesService.findStats(user);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một nhân viên' })
  @ApiOkResponse({ type: EmployeeDetailDto })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – ngoài phạm vi của role' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeDetailDto> {
    return this.employeesService.findOne(id, user);
  }

  @Get(':id/summary')
  @ApiAuth()
  @ApiOperation({
    summary: 'Tóm tắt hồ sơ nhân viên cho phiếu lương',
    description:
      'Gồm phòng ban/chức vụ, MST, số BHXH, tài khoản ngân hàng, số người phụ thuộc đang hiệu lực và hợp đồng đang active.',
  })
  @ApiOkResponse({ type: EmployeeSummaryDto })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  findSummary(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeSummaryDto> {
    return this.employeesService.findSummary(id, user);
  }

  /*
   * Hai hành động dưới đây chạy trên NHIỀU hồ sơ nên không mang `:id`, và phải
   * đứng TRƯỚC các route `:id` — nếu không `department` và `email` sẽ rơi vào
   * `:id` rồi chết ở `ParseIntPipe`.
   */
  @Patch('department')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Chuyển nhiều nhân viên sang phòng ban khác',
    description:
      '`positionId` BẮT BUỘC và phải thuộc `departmentId`: chức vụ gắn cứng với phòng ban, nên đổi phòng mà giữ chức vụ cũ sẽ để lại hồ sơ mang chức vụ của phòng khác.\n\n' +
      '`orphanedDepartments` liệt kê phòng ban vừa mất trưởng phòng vì lần chuyển này — cảnh báo, không phải lỗi.',
  })
  @ApiOkResponse({ type: ChangeDepartmentResultDto })
  @ApiNotFoundResponse({
    description: 'EMPLOYEE_NOT_FOUND – không id nào nằm trong phạm vi của bạn',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'DEPARTMENT_NOT_FOUND / POSITION_NOT_FOUND / POSITION_DEPARTMENT_MISMATCH',
  })
  changeDepartment(
    @Body() dto: ChangeDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChangeDepartmentResultDto> {
    return this.employeesService.changeDepartment(dto, user);
  }

  @Post('email')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Gửi email thông báo cho các nhân viên được chọn',
    description:
      'Gửi bằng transport mail của hệ thống — đặt `MAIL_TRANSPORT=smtp` thì dùng đúng cấu hình SMTP admin lưu ở `/settings/mail`.\n\n' +
      '`body` là văn bản THUẦN và được escape trước khi dựng HTML.\n\n' +
      'Một người lỗi không chặn cả lô: người còn lại vẫn nhận, ai trượt thì nằm trong `failed` kèm lý do (`NO_EMAIL` — hồ sơ chưa có email, `SEND_FAILED` — SMTP từ chối).\n\n' +
      '`manager` chỉ gửi được cho nhân viên phòng ban mình quản.',
  })
  @ApiOkResponse({ type: SendEmployeeEmailResultDto })
  @ApiNotFoundResponse({
    description: 'EMPLOYEE_NOT_FOUND – không id nào nằm trong phạm vi của bạn',
  })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được gửi' })
  sendEmail(
    @Body() dto: SendEmployeeEmailDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SendEmployeeEmailResultDto> {
    return this.employeesService.sendEmail(dto, user);
  }

  @Post()
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Tạo hồ sơ nhân viên',
    description:
      '`employeeCode` được sinh tự động (NV0001, NV0002…) và `fullName` ghép từ lastName + firstName — client không gửi hai field này.',
  })
  @ApiCreatedResponse({ type: EmployeeDetailDto })
  @ApiConflictResponse({
    description:
      'DUPLICATE_CCCD / DUPLICATE_EMAIL / DUPLICATE_TAX_CODE / DUPLICATE_SI_NUMBER / DUPLICATE_HI_NUMBER',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'INVALID_DATE_OF_BIRTH / INVALID_HIRE_DATE / DEPARTMENT_NOT_FOUND / POSITION_NOT_FOUND / POSITION_DEPARTMENT_MISMATCH',
  })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeDetailDto> {
    return this.employeesService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật hồ sơ nhân viên (partial update)' })
  @ApiOkResponse({ type: EmployeeDetailDto })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  @ApiConflictResponse({ description: 'DUPLICATE_* – trùng cột UNIQUE' })
  @ApiUnprocessableEntityResponse({
    description: 'INVALID_* / POSITION_DEPARTMENT_MISMATCH',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeDetailDto> {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...EMPLOYEE_DELETE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá mềm hồ sơ nhân viên',
    description:
      'Chỉ set `deleted_at`; hợp đồng/chấm công/lương giữ nguyên để còn tra cứu lịch sử. Khôi phục bằng POST /employees/:id/restore.',
  })
  @ApiOkResponse({ type: DeleteResponseDto })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin / hr_manager' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<DeleteResponseDto> {
    return this.employeesService.remove(id);
  }

  @Post(':id/restore')
  @Roles(...EMPLOYEE_DELETE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Khôi phục hồ sơ đã xoá mềm',
    description: 'Tìm hồ sơ đã xoá qua GET /employees?onlyDeleted=true.',
  })
  @ApiOkResponse({ type: RestoreResponseDto })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    description: 'EMPLOYEE_NOT_DELETED – hồ sơ đang bình thường',
  })
  restore(@Param('id', ParseIntPipe) id: number): Promise<RestoreResponseDto> {
    return this.employeesService.restore(id);
  }

  @Post(':id/avatar')
  @ApiAuth()
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_MULTER_HARD_LIMIT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Upload avatar (JPEG/PNG/WEBP, tối đa 2MB)',
    description:
      'Nhân viên tự upload ảnh của chính mình; HR upload cho bất kỳ ai. Kiểu file được xác định bằng magic bytes, không tin phần mở rộng.',
  })
  @ApiOkResponse({ type: AvatarUploadResponseDto })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – không phải ảnh của mình' })
  uploadAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedFileLike | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AvatarUploadResponseDto> {
    return this.employeesService.uploadAvatar(id, file, user);
  }
}
