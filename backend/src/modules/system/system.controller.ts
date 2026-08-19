import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { LeaveTypeResponseDto } from '@/modules/leaves/dto/leave-type-response.dto';
import { LeaveTypesService } from '@/modules/leaves/leave-types.service';
import * as provinces from '@/common/data/vn-provinces.json';
import * as wards from '@/common/data/vn-wards.json';
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
 * `/system/provinces` reads the static JSON shipped with the app (no DB table
 * exists for it — decision made in Phase 0.1). `/system/districts` and
 * `/system/wards` are still missing because the project has no source data for
 * them; until it does, the employee form collects those two codes by hand.
 */
/**
 * Nạp một lần lúc khởi động: danh sách bất biến, đọc lại mỗi request là phí.
 *
 * `default` là nhánh của CommonJS interop: với `esModuleInterop` bật, một file
 * JSON import bằng `import * as` có thể tới dưới dạng `{ default: [...] }` hoặc
 * chính mảng đó, tuỳ cách nó được biên dịch — nhận cả hai để không phụ thuộc
 * vào chi tiết đó.
 */
const provincesModule = provinces as unknown as {
  default?: ProvinceResponseDto[];
};

const PROVINCES: ProvinceResponseDto[] = provincesModule.default ?? provinces;

const wardsModule = wards as unknown as { default?: WardResponseDto[] };
const WARDS: WardResponseDto[] = wardsModule.default ?? wards;

/**
 * Gom sẵn theo tỉnh MỘT LẦN lúc khởi động. Form nhân viên luôn lọc theo tỉnh,
 * và quét tuyến tính 3.321 phần tử cho mỗi lần đổi tỉnh là công vô ích.
 */
const WARDS_BY_PROVINCE = WARDS.reduce<Record<string, WardResponseDto[]>>(
  (accumulator, ward) => {
    (accumulator[ward.provinceCode] ??= []).push(ward);
    return accumulator;
  },
  {},
);

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
      'Đọc từ file tĩnh, không phải từ DB. Bất biến trong một lần chạy nên frontend cache thoải mái.',
  })
  @ApiOkResponse({ type: [ProvinceResponseDto] })
  findProvinces(): ProvinceResponseDto[] {
    return PROVINCES;
  }

  @Get('wards')
  @ApiAuth()
  @ApiOperation({
    summary: '3.321 phường/xã/đặc khu (api-spec.md §20)',
    description:
      'Đọc từ file tĩnh sinh từ danh mục cơ quan thuế, không phải từ DB và không gọi API ngoài. ' +
      'Nên luôn truyền `?provinceCode=` — bỏ trống sẽ trả về toàn bộ 3.321 đơn vị. ' +
      'KHÔNG có endpoint quận/huyện: cấp huyện đã chấm dứt hoạt động từ 01/07/2025 (Luật 72/2025/QH15).',
  })
  @ApiOkResponse({ type: [WardResponseDto] })
  findWards(@Query() query: WardQueryDto): WardResponseDto[] {
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
