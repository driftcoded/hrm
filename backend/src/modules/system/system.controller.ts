import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { LeaveTypeResponseDto } from '@/modules/leaves/dto/leave-type-response.dto';
import { LeaveTypesService } from '@/modules/leaves/leave-types.service';
import {
  PROVINCES,
  WARDS,
  WARDS_BY_PROVINCE,
} from '@/common/data/administrative-units';
import { HolidayResponseDto } from './dto/holiday-response.dto';
import { ProvinceResponseDto } from './dto/province-response.dto';
import { WardQueryDto, WardResponseDto } from './dto/ward-response.dto';
import { SystemHolidayQueryDto } from './dto/system-holiday-query.dto';
import { HolidaysService } from './holidays.service';

/**
 * Read-only system lookup endpoints from api-spec.md §20 — return a flat array
 * (no pagination) for direct consumption by the UI.
 *
 * This is an alias of `/holidays` and `/leave-types`; CRUD lives in their
 * respective modules.
 *
 * `/system/provinces` và `/system/wards` đọc file CSV danh mục hành chính đi
 * kèm ứng dụng, không có bảng DB nào cho chúng (quyết định phạm vi từ Giai đoạn
 * 0.1). KHÔNG có `/system/districts`: cấp huyện đã chấm dứt hoạt động từ
 * 01/07/2025.
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

  @Get('provinces')
  @ApiAuth()
  @ApiOperation({
    summary: '34 tỉnh/thành phố (api-spec.md §20)',
    description:
      'Đọc từ file danh mục đi kèm ứng dụng, không phải từ DB. Bất biến trong một lần chạy nên frontend cache thoải mái.',
  })
  @ApiOkResponse({ type: [ProvinceResponseDto] })
  findProvinces(): readonly ProvinceResponseDto[] {
    return PROVINCES;
  }

  @Get('wards')
  @ApiAuth()
  @ApiOperation({
    summary: '3.321 phường/xã/đặc khu (api-spec.md §20)',
    description:
      'Đọc từ file danh mục của cơ quan thuế đi kèm ứng dụng, không phải từ DB và không gọi API ngoài. ' +
      'Nên luôn truyền `?provinceCode=` — bỏ trống sẽ trả về toàn bộ 3.321 đơn vị. ' +
      'KHÔNG có endpoint quận/huyện: cấp huyện đã chấm dứt hoạt động từ 01/07/2025 (Luật 72/2025/QH15).',
  })
  @ApiOkResponse({ type: [WardResponseDto] })
  findWards(@Query() query: WardQueryDto): readonly WardResponseDto[] {
    return query.provinceCode
      ? (WARDS_BY_PROVINCE[query.provinceCode] ?? [])
      : WARDS;
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
