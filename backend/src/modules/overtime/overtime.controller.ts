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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { FilterOvertimeDto } from './dto/filter-overtime.dto';
import { OvertimeResponseDto } from './dto/overtime-response.dto';
import { RejectOvertimeDto } from './dto/reject-overtime.dto';
import { OvertimeService } from './overtime.service';

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module).
 *
 * KHÔNG endpoint nào khai báo `@Roles()`. Quyền ở đây không chia theo vai trò
 * mà theo QUAN HỆ với bản ghi: ai cũng đăng ký làm thêm cho mình, ai cũng xem
 * đơn của mình, còn duyệt thì phải là cấp trên của người nộp — một `manager`
 * duyệt được phòng mình nhưng không duyệt được phòng khác, mà `@Roles()` không
 * diễn đạt nổi điều đó. `OvertimeService` quyết định, dựa trên `resolveScope`.
 */
@ApiTags('Overtime')
@Controller('overtime-requests')
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  @Post()
  @ApiAuth()
  @ApiOperation({
    summary: 'Đăng ký làm thêm giờ',
    description:
      'Số giờ, loại ngày và hệ số Điều 98 đều SUY RA từ `workDate` + khung giờ, client không gửi lên.\n\n' +
      '`endTime` <= `startTime` nghĩa là ca vắt sang ngày hôm sau.\n\n' +
      'Ba trần Điều 107 được kiểm ngay tại đây: 12 giờ/ngày (kể cả ca chính), 40 giờ/tháng, 200 giờ/năm.',
  })
  @ApiCreatedResponse({ type: OvertimeResponseDto })
  @ApiConflictResponse({
    description: 'OVERLAPPING_OVERTIME – trùng giờ với đơn còn hiệu lực',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'OVERTIME_DAILY_LIMIT_EXCEEDED / OVERTIME_MONTHLY_LIMIT_EXCEEDED / OVERTIME_YEARLY_LIMIT_EXCEEDED',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOvertimeDto,
  ): Promise<OvertimeResponseDto> {
    return this.overtimeService.create(user, dto);
  }

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách đơn làm thêm giờ',
    description:
      'Trang duyệt của quản lý dùng `?status=pending`. ' +
      'Nhân viên thường chỉ nhận được đơn của chính mình — `?employeeId=` của họ bị bỏ qua.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  findAll(
    @Query() filter: FilterOvertimeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<OvertimeResponseDto>> {
    return this.overtimeService.findAll(filter, user);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một đơn làm thêm giờ' })
  @ApiOkResponse({ type: OvertimeResponseDto })
  @ApiNotFoundResponse({ description: 'OVERTIME_NOT_FOUND' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OvertimeResponseDto> {
    return this.overtimeService.findOne(id, user);
  }

  @Patch(':id/approve')
  @ApiAuth()
  @ApiOperation({
    summary: 'Duyệt đơn làm thêm giờ',
    description:
      'Nhóm HR duyệt tất cả, `manager` duyệt người trong phòng mình. KHÔNG AI tự duyệt đơn của chính mình.\n\n' +
      'Trần Điều 107 được kiểm LẠI tại đây: giữa lúc nộp và lúc duyệt có thể đã có đơn khác của cùng người được duyệt.',
  })
  @ApiOkResponse({ type: OvertimeResponseDto })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN / CANNOT_APPROVE_OWN_OVERTIME',
  })
  @ApiConflictResponse({ description: 'OVERTIME_NOT_PENDING' })
  @ApiUnprocessableEntityResponse({ description: 'Vượt trần Điều 107' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OvertimeResponseDto> {
    return this.overtimeService.approve(id, user);
  }

  @Patch(':id/reject')
  @ApiAuth()
  @ApiOperation({
    summary: 'Từ chối đơn làm thêm giờ',
    description:
      'Lý do BẮT BUỘC — người nộp cần biết vì sao để sửa và nộp lại.',
  })
  @ApiOkResponse({ type: OvertimeResponseDto })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN / CANNOT_APPROVE_OWN_OVERTIME',
  })
  @ApiConflictResponse({ description: 'OVERTIME_NOT_PENDING' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectOvertimeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OvertimeResponseDto> {
    return this.overtimeService.reject(id, dto, user);
  }

  @Patch(':id/cancel')
  @ApiAuth()
  @ApiOperation({
    summary: 'Tự huỷ đơn của mình',
    description:
      'Chỉ đơn CÒN CHỜ. Đơn đã duyệt là thoả thuận hai bên, phải do người duyệt từ chối.',
  })
  @ApiOkResponse({ type: OvertimeResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – đơn của người khác' })
  @ApiConflictResponse({ description: 'OVERTIME_NOT_PENDING' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OvertimeResponseDto> {
    return this.overtimeService.cancel(id, user);
  }
}
