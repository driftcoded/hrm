import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { LeaveTypeResponseDto } from '@/modules/leaves/dto/leave-type-response.dto';
import { LeaveTypesService } from '@/modules/leaves/leave-types.service';
import { HolidayResponseDto } from './dto/holiday-response.dto';
import { SystemHolidayQueryDto } from './dto/system-holiday-query.dto';
import { HolidaysService } from './holidays.service';

/**
 * Read-only system lookup endpoints from api-spec.md §20 — return a flat array
 * (no pagination) for direct consumption by the UI.
 *
 * This is an alias of `/holidays` and `/leave-types`; CRUD lives in their
 * respective modules. `/system/provinces|districts|wards` will be added to
 * this controller in a later phase (province/district/ward data has no
 * dedicated table — decision made in Phase 0.1).
 */
@ApiTags('System')
@Controller('system')
export class SystemController {
  constructor(
    private readonly holidaysService: HolidaysService,
    private readonly leaveTypesService: LeaveTypesService,
  ) {}

  @Get('holidays')
  @ApiAuth()
  @ApiOperation({
    summary: 'Lịch nghỉ lễ của một năm (api-spec.md §20)',
    description:
      'Mảng phẳng, sắp xếp theo ngày. Không truyền `year` → lấy năm hiện tại.',
  })
  @ApiOkResponse({ type: [HolidayResponseDto] })
  findHolidays(
    @Query() query: SystemHolidayQueryDto,
  ): Promise<HolidayResponseDto[]> {
    return this.holidaysService.findByYear(query.year);
  }

  @Get('leave-types')
  @ApiAuth()
  @ApiOperation({
    summary: 'Loại nghỉ phép đang áp dụng (api-spec.md §20)',
    description:
      'Chỉ trả về loại `isActive = true`. ⚠️ api-spec.md ghi endpoint này là public; ở đây vẫn yêu cầu đăng nhập theo §8 + PLAN 2.1.',
  })
  @ApiOkResponse({ type: [LeaveTypeResponseDto] })
  findLeaveTypes(): Promise<LeaveTypeResponseDto[]> {
    return this.leaveTypesService.findAll({ isActive: true });
  }
}
