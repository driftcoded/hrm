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
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AdjustLeaveBalanceDto } from './dto/adjust-leave-balance.dto';
import { FilterLeaveBalanceDto } from './dto/filter-leave-balance.dto';
import { InitLeaveBalanceDto } from './dto/init-leave-balance.dto';
import {
  InitLeaveBalanceResultDto,
  LeaveBalanceResponseDto,
} from './dto/leave-balance-response.dto';
import { LeaveBalancesService } from './leave-balances.service';

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module).
 *
 * `GET` không khai báo `@Roles()`: phạm vi dữ liệu do service quyết định theo
 * hồ sơ nhân viên (`resolveScope`) — trưởng phòng chỉ thấy phòng mình. Các
 * endpoint GHI có `@Roles()` vì quỹ phép là quyền lợi của người lao động.
 */
@ApiTags('Leave Balances')
@Controller('leave-balances')
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}

  /*
   * Khai báo TRƯỚC `@Patch(':id')` không cần thiết vì khác method, nhưng `init`
   * đặt trên đầu để đọc file theo đúng thứ tự vòng đời: cấp quỹ → xem → sửa.
   */
  @Post('init')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Cấp quỹ phép năm cho toàn bộ nhân viên đang làm việc',
    description:
      'Số ngày tính theo Điều 113 BLLĐ 2019: 12 ngày + 1 ngày mỗi 5 năm thâm niên. Năm đầu tiên tính theo tỉ lệ tháng đã làm.\n\n' +
      'KHÔNG ghi đè quỹ đã có — chạy lại chỉ tạo cho những người còn thiếu.\n\n' +
      '`?dryRun=true` chỉ tính thử, không ghi gì.\n\n' +
      'Chỉ cấp cho loại phép `ANNUAL`. Ốm đau, thai sản, cưới hỏi, tang chế phát sinh theo sự việc nên không có quỹ cấp trước.',
  })
  @ApiCreatedResponse({ type: InitLeaveBalanceResultDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiUnprocessableEntityResponse({
    description: 'ANNUAL_LEAVE_TYPE_MISSING – chưa seed loại phép năm',
  })
  initYear(
    @Body() dto: InitLeaveBalanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InitLeaveBalanceResultDto> {
    return this.leaveBalancesService.initYear(dto, user);
  }

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Quỹ phép theo năm',
    description:
      'Lọc theo `employeeId`, `departmentId`, `leaveTypeId`, `year`. Bỏ trống `year` thì lấy năm hiện tại — quỹ phép luôn thuộc về một năm cụ thể.\n\n' +
      '`remainingDays` là cột VIRTUAL của DB: `allocated + carriedOver − used − pending`.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  findAll(
    @Query() filter: FilterLeaveBalanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<LeaveBalanceResponseDto>> {
    return this.leaveBalancesService.findAll(filter, user);
  }

  @Patch(':id')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Điều chỉnh quỹ phép của một người',
    description:
      'Chỉ sửa được `allocatedDays` và `carriedOver`. `usedDays`/`pendingDays` là hệ quả của các đơn nghỉ — sai ở đâu thì sửa đơn ở đó.\n\n' +
      '`reason` BẮT BUỘC: quỹ phép là quyền lợi của người lao động, mọi thay đổi thủ công phải nói được vì sao.',
  })
  @ApiOkResponse({ type: LeaveBalanceResponseDto })
  @ApiNotFoundResponse({ description: 'LEAVE_BALANCE_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    description:
      'LEAVE_BALANCE_BELOW_COMMITTED – hạ quỹ xuống dưới số ngày đã dùng + đang chờ',
  })
  adjust(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdjustLeaveBalanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LeaveBalanceResponseDto> {
    return this.leaveBalancesService.adjust(id, dto, user);
  }
  @Delete(':id')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá một dòng quỹ phép cấp nhầm',
    description:
      'CHỈ khi dòng quỹ chưa bị tiêu ngày nào (`usedDays` và `pendingDays` đều bằng 0).\n\n' +
      'Đã có đơn nghỉ trừ vào dòng này thì xoá là bỏ rơi những đơn đó — hạ quỹ bằng `PATCH /leave-balances/:id` thay vì xoá.',
  })
  @ApiOkResponse({ description: 'id + deleted' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiNotFoundResponse({ description: 'LEAVE_BALANCE_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({ description: 'LEAVE_BALANCE_IN_USE' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: number; deleted: boolean }> {
    return this.leaveBalancesService.remove(id, user);
  }
}
