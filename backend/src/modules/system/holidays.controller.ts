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
} from '@nestjs/swagger';
import { MASTER_DATA_WRITE_ROLES } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { DeleteResponseDto } from '@/common/dto/delete-response.dto';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { FilterHolidayDto } from './dto/filter-holiday.dto';
import {
  GenerateHolidaysDto,
  GenerateHolidaysResultDto,
} from './dto/generate-holidays.dto';
import { HolidayResponseDto } from './dto/holiday-response.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { HolidaysService } from './holidays.service';

/**
 * GET: any authenticated role. POST/PATCH/DELETE: admin / hr_manager / hr_staff.
 * api-spec.md §20 only documents `GET /system/holidays`; CRUD lives here at
 * `/holidays` (see SystemController for the year-based read alias).
 */
@ApiTags('Holidays')
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách ngày lễ (phân trang, lọc theo năm/loại)',
    description: 'limit tối đa 100 (api-spec.md §1.2).',
  })
  @ApiOkResponse({ type: [HolidayResponseDto] })
  findAll(
    @Query() filter: FilterHolidayDto,
  ): Promise<PaginatedResponseDto<HolidayResponseDto>> {
    return this.holidaysService.findAll(filter);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một ngày lễ' })
  @ApiOkResponse({ type: HolidayResponseDto })
  @ApiNotFoundResponse({ description: 'HOLIDAY_NOT_FOUND' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<HolidayResponseDto> {
    return this.holidaysService.findOne(id);
  }

  @Post()
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Thêm ngày lễ',
    description: '`year` được suy ra từ `holidayDate`, không nhận từ client.',
  })
  @ApiCreatedResponse({ type: HolidayResponseDto })
  @ApiConflictResponse({ description: 'DUPLICATE_HOLIDAY_DATE' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  create(@Body() dto: CreateHolidayDto): Promise<HolidayResponseDto> {
    return this.holidaysService.create(dto);
  }

  @Post('generate')
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Sinh lịch nghỉ lễ pháp định của một năm',
    description:
      'Tính 11 ngày nghỉ theo Điều 112 BLLĐ 2019, gồm cả Tết và Giỗ Tổ Hùng Vương ' +
      'quy đổi từ âm lịch, cộng ngày nghỉ bù khi ngày lễ rơi vào cuối tuần. ' +
      'Ngày đã có trong lịch được GIỮ NGUYÊN, không ghi đè. ' +
      'Khoảng nghỉ Tết và ngày liền kề 2/9 do Chính phủ chốt từng năm nên đây là ' +
      'bản đề xuất — dùng `preview` để xem trước khi ghi.',
  })
  @ApiCreatedResponse({ type: GenerateHolidaysResultDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  generate(
    @Body() dto: GenerateHolidaysDto,
  ): Promise<GenerateHolidaysResultDto> {
    return this.holidaysService.generate(dto);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật ngày lễ' })
  @ApiOkResponse({ type: HolidayResponseDto })
  @ApiNotFoundResponse({ description: 'HOLIDAY_NOT_FOUND' })
  @ApiConflictResponse({ description: 'DUPLICATE_HOLIDAY_DATE' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHolidayDto,
  ): Promise<HolidayResponseDto> {
    return this.holidaysService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá ngày lễ (xoá vật lý – bảng không có deleted_at)',
  })
  @ApiOkResponse({ type: DeleteResponseDto })
  @ApiNotFoundResponse({ description: 'HOLIDAY_NOT_FOUND' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<DeleteResponseDto> {
    return this.holidaysService.remove(id);
  }
}
