import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { EMPLOYEE_WRITE_ROLES } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { DeleteResponseDto } from '@/common/dto/delete-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { DependentsService } from './dependents.service';
import { CreateDependentDto } from './dto/create-dependent.dto';
import { DependentResponseDto } from './dto/dependent-response.dto';
import { UpdateDependentDto } from './dto/update-dependent.dto';

/**
 * Route lồng dưới `/employees/:employeeId` đúng như api-spec.md §11 — người
 * phụ thuộc không tồn tại độc lập với nhân viên (FK CASCADE).
 *
 * GET không khai báo `@Roles()`: nhân viên phải xem được người phụ thuộc mình
 * đã đăng ký; service kiểm tra phạm vi. Ghi/xoá dành cho nhóm HR — đây là hồ sơ
 * thuế, không phải thông tin nhân viên tự sửa được.
 */
@ApiTags('Dependents')
@Controller('employees/:employeeId/dependents')
export class DependentsController {
  constructor(private readonly dependentsService: DependentsService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách người phụ thuộc (giảm trừ gia cảnh) của một nhân viên',
    description:
      'Người đang được giảm trừ xếp trước. `isCurrentlyDeductible` cho biết hôm nay có được tính hay không.',
  })
  @ApiOkResponse({ type: [DependentResponseDto] })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – ngoài phạm vi của role' })
  findAll(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DependentResponseDto[]> {
    return this.dependentsService.findAll(employeeId, user);
  }

  @Post()
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Đăng ký người phụ thuộc',
    description:
      'Một người chỉ được khai cho MỘT người nộp thuế (Điều 19 Luật Thuế TNCN) — trùng CCCD/MST với người phụ thuộc đang hiệu lực của bất kỳ nhân viên nào sẽ bị từ chối.',
  })
  @ApiCreatedResponse({ type: DependentResponseDto })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  @ApiConflictResponse({ description: 'DEPENDENT_ALREADY_CLAIMED' })
  @ApiUnprocessableEntityResponse({ description: 'INVALID_DATE_RANGE' })
  create(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() dto: CreateDependentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DependentResponseDto> {
    return this.dependentsService.create(employeeId, dto, user);
  }

  @Patch(':dependentId')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Cập nhật người phụ thuộc / ngừng giảm trừ',
    description:
      'Chuyển `status` sang `inactive` bắt buộc kèm `reasonInactive`.',
  })
  @ApiOkResponse({ type: DependentResponseDto })
  @ApiNotFoundResponse({
    description: 'EMPLOYEE_NOT_FOUND / DEPENDENT_NOT_FOUND',
  })
  @ApiConflictResponse({ description: 'DEPENDENT_ALREADY_CLAIMED' })
  @ApiUnprocessableEntityResponse({
    description: 'DEPENDENT_REASON_REQUIRED / INVALID_DATE_RANGE',
  })
  update(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('dependentId', ParseIntPipe) dependentId: number,
    @Body() dto: UpdateDependentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DependentResponseDto> {
    return this.dependentsService.update(employeeId, dependentId, dto, user);
  }

  @Delete(':dependentId')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá người phụ thuộc',
    description:
      'Bảng `dependents` không có cột xoá mềm (schema §3.2) nên đây là xoá vĩnh viễn. Nếu chỉ muốn NGỪNG giảm trừ mà vẫn giữ lịch sử thì dùng PATCH đặt status=inactive.',
  })
  @ApiOkResponse({ type: DeleteResponseDto })
  @ApiNotFoundResponse({
    description: 'EMPLOYEE_NOT_FOUND / DEPENDENT_NOT_FOUND',
  })
  remove(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('dependentId', ParseIntPipe) dependentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeleteResponseDto> {
    return this.dependentsService.remove(employeeId, dependentId, user);
  }
}
