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
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { LeaveCalendarQueryDto } from './dto/calendar-query.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { FilterLeaveRequestDto } from './dto/filter-leave-request.dto';
import {
  ApproveLeaveRequestResultDto,
  DeleteLeaveRequestResultDto,
  LeaveRequestResponseDto,
} from './dto/leave-request-response.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { LeaveRequestsService } from './leave-requests.service';

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module).
 *
 * KHÔNG endpoint nào khai báo `@Roles()`. Quyền ở đây không chia theo vai trò mà
 * theo QUAN HỆ với bản ghi: quản lý ghi nhận được cho phòng mình nhưng không
 * phòng khác, và người đã ghi một đơn không duyệt được chính đơn đó —
 * `@Roles()` không diễn đạt nổi điều đó. `LeaveRequestsService` quyết định, dựa
 * trên `resolveScope` và `recorded_by`.
 */
@ApiTags('Leave Requests')
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @ApiAuth()
  @ApiOperation({
    summary: 'Ghi nhận đơn nghỉ phép cho một nhân viên',
    description:
      'Nhân viên không đăng nhập hệ thống này — quản lý ghi nhận cho phòng mình, nhân sự ghi cho bất kỳ ai.\n\n' +
      'Số ngày phép bị trừ do SERVER tính: chỉ đếm ngày làm việc, bỏ T7/CN và ngày lễ, hỗ trợ nghỉ nửa ngày ở hai đầu.\n\n' +
      'Quỹ phép bị giữ chỗ (`pending_days`) ngay khi ghi nhận, trong cùng một transaction với đơn.',
  })
  @ApiCreatedResponse({ type: LeaveRequestResponseDto })
  @ApiNotFoundResponse({
    description: 'EMPLOYEE_NOT_FOUND / LEAVE_TYPE_NOT_FOUND',
  })
  @ApiConflictResponse({
    description: 'OVERLAPPING_LEAVE – trùng ngày với đơn còn hiệu lực',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'INVALID_LEAVE_RANGE · LEAVE_SPANS_TWO_YEARS · LEAVE_NO_WORKING_DAYS · LEAVE_BELOW_MINIMUM · LEAVE_ABOVE_MAX_CONSECUTIVE · INSUFFICIENT_LEAVE_BALANCE',
  })
  create(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    return this.leaveRequestsService.create(dto, user);
  }

  @Patch(':id')
  @ApiAuth()
  @ApiOperation({
    summary: 'Sửa đơn nghỉ phép còn chờ duyệt',
    description:
      'Người GHI NHẬN sửa đơn của mình, nhân sự sửa của bất kỳ ai. Chỉ đơn còn `pending`.\n\n' +
      'KHÔNG đổi được `employeeId`: đổi người được nghỉ là một đơn khác, vì quỹ phép và kiểm tra trùng ngày đều tính theo nhân viên.\n\n' +
      'Số ngày phép được tính LẠI từ khoảng ngày mới, và quỹ phép trả chỗ cũ trước khi giữ chỗ mới — cùng một transaction.',
  })
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiNotFoundResponse({
    description: 'LEAVE_NOT_FOUND / LEAVE_TYPE_NOT_FOUND',
  })
  @ApiConflictResponse({
    description: 'LEAVE_NOT_PENDING · OVERLAPPING_LEAVE',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'INVALID_LEAVE_RANGE · LEAVE_SPANS_TWO_YEARS · LEAVE_NO_WORKING_DAYS · LEAVE_BELOW_MINIMUM · LEAVE_ABOVE_MAX_CONSECUTIVE · INSUFFICIENT_LEAVE_BALANCE',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    return this.leaveRequestsService.update(id, dto, user);
  }

  /*
   * Khai báo TRƯỚC `@Get(':id')`. Nest so khớp theo thứ tự khai báo, nên đặt sau
   * thì `calendar` sẽ rơi vào `:id` và chết ở `ParseIntPipe`.
   */
  @Get('calendar')
  @ApiAuth()
  @ApiOperation({
    summary: 'Ai đang nghỉ trong khoảng ngày',
    description:
      'Chỉ trả đơn ĐÃ DUYỆT — một đơn còn chờ duyệt chưa cho phép ai nghỉ cả.\n\n' +
      '`from`/`to` bắt buộc. `manager` chỉ thấy phòng ban mình quản.',
  })
  @ApiOkResponse({ type: [LeaveRequestResponseDto] })
  calendar(
    @Query() query: LeaveCalendarQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto[]> {
    return this.leaveRequestsService.calendar(query.from, query.to, user);
  }

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách đơn nghỉ phép',
    description:
      'Trang duyệt dùng `?status=pending`. `from`/`to` lọc theo kỳ nghỉ GIAO NHAU với khoảng — một kỳ nghỉ bắc qua đầu tháng vẫn hiện trong tháng đó.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  findAll(
    @Query() filter: FilterLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<LeaveRequestResponseDto>> {
    return this.leaveRequestsService.findAll(filter, user);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một đơn nghỉ phép' })
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  @ApiNotFoundResponse({ description: 'LEAVE_NOT_FOUND' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    return this.leaveRequestsService.findOne(id, user);
  }

  @Patch(':id/approve')
  @ApiAuth()
  @ApiOperation({
    summary: 'Duyệt đơn nghỉ phép',
    description:
      'Nhân sự duyệt. `manager` ghi nhận nhưng KHÔNG duyệt, và người đã ghi một đơn không duyệt được chính đơn đó.\n\n' +
      'Chuyển `pending_days` sang `used_days`, và ghi những ngày nghỉ vào bảng chấm công với trạng thái `leave`.\n\n' +
      'Ngày ĐÃ CÓ dữ liệu chấm công thì KHÔNG ghi đè — trả về ở `attendanceConflicts` để người xem tự xử lý.',
  })
  @ApiOkResponse({ type: ApproveLeaveRequestResultDto })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN / CANNOT_APPROVE_OWN_RECORD',
  })
  @ApiConflictResponse({ description: 'LEAVE_NOT_PENDING' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApproveLeaveRequestResultDto> {
    return this.leaveRequestsService.approve(id, user);
  }

  @Patch(':id/reject')
  @ApiAuth()
  @ApiOperation({
    summary: 'Từ chối đơn nghỉ phép',
    description: 'Lý do BẮT BUỘC. Quỹ phép được trả lại chỗ đã giữ.',
  })
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN / CANNOT_APPROVE_OWN_RECORD',
  })
  @ApiConflictResponse({ description: 'LEAVE_NOT_PENDING' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    return this.leaveRequestsService.reject(id, dto, user);
  }

  @Patch(':id/cancel')
  @ApiAuth()
  @ApiOperation({
    summary: 'Rút lại đơn vừa ghi nhận',
    description:
      'Người GHI NHẬN hoặc nhân sự. Chỉ đơn còn `pending`, và đơn vẫn nằm lại trong danh sách với trạng thái `cancelled`.\n\n' +
      'Muốn gỡ hẳn một đơn (kể cả đã duyệt) thì dùng `DELETE /leave-requests/:id`.',
  })
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiConflictResponse({ description: 'LEAVE_NOT_PENDING' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    return this.leaveRequestsService.cancel(id, user);
  }

  @Delete(':id')
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá hẳn đơn nghỉ phép',
    description:
      'Đơn còn `pending`: người GHI NHẬN hoặc nhân sự xoá được. Đơn đã duyệt / từ chối / đã rút: CHỈ nhân sự — xoá nó là đảo ngược một quyết định đã ra.\n\n' +
      'Xoá gỡ sạch dấu vết đơn để lại: hoàn `pending_days` (đơn chờ) hoặc `used_days` (đơn đã duyệt), và gỡ những ngày `leave` mà lúc duyệt nó đã ghi vào bảng chấm công.\n\n' +
      'Dòng chấm công ĐÃ BỊ SỬA sang trạng thái khác thì GIỮ LẠI — đó là ngày công thật. Số dòng giữ lại trả về ở `attendanceDaysKept`.',
  })
  @ApiOkResponse({ type: DeleteLeaveRequestResultDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiNotFoundResponse({ description: 'LEAVE_NOT_FOUND' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeleteLeaveRequestResultDto> {
    return this.leaveRequestsService.remove(id, user);
  }
}
