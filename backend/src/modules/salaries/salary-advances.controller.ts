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
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { FilterSalaryAdvanceDto } from './dto/filter-salary-advance.dto';
import { RejectSalaryAdvanceDto } from './dto/reject-salary-advance.dto';
import { SalaryAdvanceResponseDto } from './dto/salary-advance-response.dto';
import { SalaryAdvancesService } from './salary-advances.service';

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module).
 *
 * Không `@Roles()`: quyền ở đây theo QUAN HỆ với bản ghi — quản lý ghi được cho
 * phòng mình chứ không phòng khác, và người đã ghi một phiếu không duyệt được
 * chính phiếu đó. Service quyết định, dựa trên `resolveScope` và `recorded_by`.
 */
@ApiTags('Salary Advances')
@Controller('salary-advances')
export class SalaryAdvancesController {
  constructor(private readonly service: SalaryAdvancesService) {}

  @Post()
  @ApiAuth()
  @ApiOperation({
    summary: 'Ghi nhận phiếu tạm ứng lương',
    description:
      'Nhân viên không đăng nhập hệ thống này — quản lý ghi cho phòng mình, nhân sự ghi cho bất kỳ ai.\n\n' +
      '`deductMonth`/`deductYear` là KỲ LƯƠNG bị trừ, tách khỏi `advanceDate` là ngày thực chi.',
  })
  @ApiCreatedResponse({ type: SalaryAdvanceResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  create(
    @Body() dto: CreateSalaryAdvanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalaryAdvanceResponseDto> {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách phiếu tạm ứng',
    description: '`manager` chỉ thấy phòng ban mình quản.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  findAll(
    @Query() filter: FilterSalaryAdvanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<SalaryAdvanceResponseDto>> {
    return this.service.findAll(filter, user);
  }

  @Patch(':id/approve')
  @ApiAuth()
  @ApiOperation({
    summary: 'Duyệt phiếu tạm ứng',
    description:
      'Tiền mặt ra khỏi công ty, nên người ĐÃ GHI phiếu không duyệt được chính phiếu đó.',
  })
  @ApiOkResponse({ type: SalaryAdvanceResponseDto })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN / CANNOT_APPROVE_OWN_RECORD',
  })
  @ApiConflictResponse({ description: 'ADVANCE_NOT_PENDING' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalaryAdvanceResponseDto> {
    return this.service.approve(id, user);
  }

  @Patch(':id/reject')
  @ApiAuth()
  @ApiOperation({
    summary: 'Từ chối phiếu tạm ứng',
    description: 'Lý do BẮT BUỘC.',
  })
  @ApiOkResponse({ type: SalaryAdvanceResponseDto })
  @ApiConflictResponse({ description: 'ADVANCE_NOT_PENDING' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectSalaryAdvanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalaryAdvanceResponseDto> {
    return this.service.reject(id, dto, user);
  }

  @Patch(':id/cancel')
  @ApiAuth()
  @ApiOperation({
    summary: 'Rút lại phiếu vừa ghi',
    description: 'Người GHI NHẬN hoặc nhân sự. Chỉ phiếu còn chờ duyệt.',
  })
  @ApiOkResponse({ type: SalaryAdvanceResponseDto })
  @ApiConflictResponse({ description: 'ADVANCE_NOT_PENDING' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalaryAdvanceResponseDto> {
    return this.service.cancel(id, user);
  }
}
