import {
  Body,
  Controller,
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
} from '@nestjs/swagger';
import { EMPLOYEE_WRITE_ROLES } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AttendancesService } from './attendances.service';
import {
  AttendanceResponseDto,
  MyAttendanceResponseDto,
} from './dto/attendance-response.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { FilterAttendanceDto } from './dto/filter-attendance.dto';
import { MonthQueryDto } from './dto/month-query.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module).
 *
 * `check-in`, `check-out` và `/me` KHÔNG khai báo `@Roles()`: mọi vai trò đều
 * tự chấm công và xem bảng công của mình. `GET /attendances` cũng không khai
 * báo — phạm vi dữ liệu do service quyết định theo hồ sơ nhân viên
 * (`resolveScope`), giống `/contracts`. Chỉ `PATCH` mới có `@Roles()` vì sửa
 * bảng chấm công là sửa căn cứ trả lương.
 */
@ApiTags('Attendances')
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Post('check-in')
  @ApiAuth()
  @ApiOperation({
    summary: 'Chấm công vào',
    description:
      'Ghi giờ vào cho CHÍNH người đang đăng nhập, giờ do server đọc theo múi giờ Việt Nam. ' +
      'Chấm lần thứ hai trong ngày trả 409 — lần đầu là lần được tính (PLAN 4.1).',
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  @ApiConflictResponse({ description: 'ALREADY_CHECKED_IN' })
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckInDto,
  ): Promise<AttendanceResponseDto> {
    return this.attendancesService.checkIn(user, dto);
  }

  @Post('check-out')
  @ApiAuth()
  @ApiOperation({
    summary: 'Chấm công ra',
    description:
      'Ghi giờ ra và tính giờ công (đã trừ 60 phút nghỉ trưa), đi muộn, về sớm. ' +
      'Chưa chấm vào thì trả 404 NOT_CHECKED_IN chứ không đoán hộ giờ vào.',
  })
  @ApiOkResponse({ type: AttendanceResponseDto })
  @ApiNotFoundResponse({ description: 'NOT_CHECKED_IN' })
  @ApiConflictResponse({ description: 'ALREADY_CHECKED_OUT' })
  checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckOutDto,
  ): Promise<AttendanceResponseDto> {
    return this.attendancesService.checkOut(user, dto);
  }

  @Get('me')
  @ApiAuth()
  @ApiOperation({
    summary: 'Bảng chấm công tháng của chính mình',
    description:
      'Mặc định là tháng hiện tại. Trả về `summary` (ngày công, đi muộn, vắng, giờ làm thêm) và `records`.\n\n' +
      '`summary.overtimeHours` là số giờ đã ở lại làm THỰC TẾ; `summary.approvedOvertimeHours` mới là số giờ được trả tiền.',
  })
  @ApiOkResponse({ type: MyAttendanceResponseDto })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MonthQueryDto,
  ): Promise<MyAttendanceResponseDto> {
    return this.attendancesService.findMine(user, query);
  }

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách chấm công toàn công ty',
    description:
      'Lọc theo `employeeId`, `departmentId`, `month`+`year`, `status`. ' +
      '`manager` chỉ thấy phòng ban mình quản; nhân viên thường nhận 403 và phải dùng `/attendances/me`.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN – nhân viên thường không xem được danh sách chung',
  })
  findAll(
    @Query() filter: FilterAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<AttendanceResponseDto>> {
    return this.attendancesService.findAll(filter, user);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một bản ghi chấm công' })
  @ApiOkResponse({ type: AttendanceResponseDto })
  @ApiNotFoundResponse({ description: 'ATTENDANCE_NOT_FOUND' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttendanceResponseDto> {
    return this.attendancesService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Điều chỉnh chấm công (máy lỗi, quên chấm)',
    description:
      'Chỉ nhóm HR. `note` BẮT BUỘC — bản ghi phải tự nói được vì sao nó khác với thứ máy đã ghi.\n\n' +
      'Sửa giờ thì giờ công, đi muộn, về sớm được TÍNH LẠI; không có chuyện giờ mới đi với số cũ.',
  })
  @ApiOkResponse({ type: AttendanceResponseDto })
  @ApiNotFoundResponse({ description: 'ATTENDANCE_NOT_FOUND' })
  @ApiConflictResponse({
    description: 'INVALID_ATTENDANCE_TIMES – giờ ra sớm hơn giờ vào',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttendanceResponseDto> {
    return this.attendancesService.update(id, dto, user);
  }
}
