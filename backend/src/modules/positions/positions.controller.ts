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
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { FilterPositionDto } from './dto/filter-position.dto';
import { PositionResponseDto } from './dto/position-response.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { PositionsService } from './positions.service';

/**
 * GET: any authenticated role. POST/PATCH/DELETE: admin / hr_manager / hr_staff.
 * No business logic here (CLAUDE.md §Module architecture).
 */
@ApiTags('Positions')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách chức vụ (phân trang, lọc theo phòng ban/level)',
    description: 'limit tối đa 100 (api-spec.md §1.2).',
  })
  @ApiOkResponse({ type: [PositionResponseDto] })
  findAll(
    @Query() filter: FilterPositionDto,
  ): Promise<PaginatedResponseDto<PositionResponseDto>> {
    return this.positionsService.findAll(filter);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một chức vụ' })
  @ApiOkResponse({ type: PositionResponseDto })
  @ApiNotFoundResponse({ description: 'POSITION_NOT_FOUND' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PositionResponseDto> {
    return this.positionsService.findOne(id);
  }

  @Post()
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Tạo chức vụ mới (gắn với 1 phòng ban)' })
  @ApiCreatedResponse({ type: PositionResponseDto })
  @ApiConflictResponse({ description: 'DUPLICATE_POSITION_CODE' })
  @ApiUnprocessableEntityResponse({
    description: 'DEPARTMENT_NOT_FOUND / INVALID_SALARY_RANGE',
  })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  create(@Body() dto: CreatePositionDto): Promise<PositionResponseDto> {
    return this.positionsService.create(dto);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật chức vụ' })
  @ApiOkResponse({ type: PositionResponseDto })
  @ApiNotFoundResponse({ description: 'POSITION_NOT_FOUND' })
  @ApiConflictResponse({ description: 'DUPLICATE_POSITION_CODE' })
  @ApiUnprocessableEntityResponse({
    description: 'DEPARTMENT_NOT_FOUND / INVALID_SALARY_RANGE',
  })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePositionDto,
  ): Promise<PositionResponseDto> {
    return this.positionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá mềm chức vụ',
    description:
      'Còn nhân viên đang giữ chức vụ → 422 POSITION_HAS_EMPLOYEES, KHÔNG xoá nhân viên.',
  })
  @ApiOkResponse({ type: DeleteResponseDto })
  @ApiNotFoundResponse({ description: 'POSITION_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({ description: 'POSITION_HAS_EMPLOYEES' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<DeleteResponseDto> {
    return this.positionsService.remove(id);
  }
}
