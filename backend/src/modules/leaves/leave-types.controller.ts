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
import { MASTER_DATA_WRITE_ROLES } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { DeleteResponseDto } from '@/common/dto/delete-response.dto';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { FilterLeaveTypeDto } from './dto/filter-leave-type.dto';
import { LeaveTypeResponseDto } from './dto/leave-type-response.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { LeaveTypesService } from './leave-types.service';

/**
 * GET: any authenticated role. POST/PATCH/DELETE: admin / hr_manager / hr_staff.
 *
 * api-spec.md §20 describes `/system/leave-types` as "public, no auth
 * required"; here GET still requires authentication per §8 and the PLAN 2.1
 * requirement.
 */
@ApiTags('Leave Types')
@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách loại nghỉ phép',
    description:
      'Trả về MẢNG (không phân trang) đúng api-spec.md §8 – bảng leave_types có khoá chính TINYINT nên luôn nhỏ.',
  })
  @ApiOkResponse({ type: [LeaveTypeResponseDto] })
  findAll(
    @Query() filter: FilterLeaveTypeDto,
  ): Promise<LeaveTypeResponseDto[]> {
    return this.leaveTypesService.findAll(filter);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một loại nghỉ phép' })
  @ApiOkResponse({ type: LeaveTypeResponseDto })
  @ApiNotFoundResponse({ description: 'LEAVE_TYPE_NOT_FOUND' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LeaveTypeResponseDto> {
    return this.leaveTypesService.findOne(id);
  }

  @Post()
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Tạo loại nghỉ phép mới' })
  @ApiCreatedResponse({ type: LeaveTypeResponseDto })
  @ApiConflictResponse({ description: 'DUPLICATE_LEAVE_TYPE_CODE' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  create(@Body() dto: CreateLeaveTypeDto): Promise<LeaveTypeResponseDto> {
    return this.leaveTypesService.create(dto);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật chính sách của loại nghỉ phép' })
  @ApiOkResponse({ type: LeaveTypeResponseDto })
  @ApiNotFoundResponse({ description: 'LEAVE_TYPE_NOT_FOUND' })
  @ApiConflictResponse({ description: 'DUPLICATE_LEAVE_TYPE_CODE' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeaveTypeDto,
  ): Promise<LeaveTypeResponseDto> {
    return this.leaveTypesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá loại nghỉ phép (xoá vật lý – bảng không có deleted_at)',
    description:
      'Đã có đơn nghỉ / số dư phép tham chiếu → 422 LEAVE_TYPE_IN_USE. Dùng PATCH isActive=false để ẩn thay vì xoá.',
  })
  @ApiOkResponse({ type: DeleteResponseDto })
  @ApiNotFoundResponse({ description: 'LEAVE_TYPE_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({ description: 'LEAVE_TYPE_IN_USE' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<DeleteResponseDto> {
    return this.leaveTypesService.remove(id);
  }
}
