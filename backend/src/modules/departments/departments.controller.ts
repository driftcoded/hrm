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
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { MASTER_DATA_WRITE_ROLES } from '@/common/constants/roles.constant';
import { DeleteResponseDto } from '@/common/dto/delete-response.dto';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import {
  DepartmentResponseDto,
  DepartmentTreeNodeDto,
} from './dto/department-response.dto';
import { FilterDepartmentDto } from './dto/filter-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

/**
 * Controller ONLY receives requests / returns responses (CLAUDE.md §Module
 * architecture): all business validation (duplicate code, cycle detection,
 * delete guards) lives in DepartmentsService.
 *
 * Authorization: GET is open to ANY authenticated role (no `@Roles`
 * declared); POST/PATCH/DELETE are restricted to admin / hr_manager /
 * hr_staff.
 */
@ApiTags('Departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary:
      'Danh sách phòng ban (flat, có phân trang) hoặc cây nếu ?tree=true',
    description:
      'limit tối đa 100 (api-spec.md §1.2). `?tree=true` trả về mảng lồng nhau giống GET /departments/tree và bỏ qua page/limit.',
  })
  @ApiOkResponse({
    type: [DepartmentResponseDto],
    description:
      'Mặc định: `{ items, meta }` (items = DepartmentResponseDto[]). Với `?tree=true`: mảng DepartmentTreeNodeDto lồng nhau.',
  })
  findAll(
    @Query() filter: FilterDepartmentDto,
  ): Promise<
    PaginatedResponseDto<DepartmentResponseDto> | DepartmentTreeNodeDto[]
  > {
    return filter.tree === true
      ? this.departmentsService.findTree()
      : this.departmentsService.findAll(filter);
  }

  @Get('tree')
  @ApiAuth()
  @ApiOperation({ summary: 'Cây phòng ban (lồng theo parent_id)' })
  @ApiOkResponse({ type: [DepartmentTreeNodeDto] })
  findTree(): Promise<DepartmentTreeNodeDto[]> {
    return this.departmentsService.findTree();
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một phòng ban' })
  @ApiOkResponse({ type: DepartmentResponseDto })
  @ApiNotFoundResponse({ description: 'DEPARTMENT_NOT_FOUND' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DepartmentResponseDto> {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Tạo phòng ban mới' })
  @ApiCreatedResponse({ type: DepartmentResponseDto })
  @ApiConflictResponse({ description: 'DUPLICATE_DEPARTMENT_CODE' })
  @ApiUnprocessableEntityResponse({
    description: 'PARENT_DEPARTMENT_NOT_FOUND / EMPLOYEE_NOT_FOUND',
  })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  create(@Body() dto: CreateDepartmentDto): Promise<DepartmentResponseDto> {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Cập nhật phòng ban (đổi cha, đổi trưởng phòng…)',
    description:
      'Không cho phép tạo chu trình: đặt cha là chính nó hoặc là phòng ban con cháu → 422 DEPARTMENT_CYCLE.',
  })
  @ApiOkResponse({ type: DepartmentResponseDto })
  @ApiNotFoundResponse({ description: 'DEPARTMENT_NOT_FOUND' })
  @ApiConflictResponse({ description: 'DUPLICATE_DEPARTMENT_CODE' })
  @ApiUnprocessableEntityResponse({
    description:
      'DEPARTMENT_CYCLE / PARENT_DEPARTMENT_NOT_FOUND / EMPLOYEE_NOT_FOUND',
  })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...MASTER_DATA_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá mềm phòng ban',
    description:
      'KHÔNG xoá lan sang nhân viên: còn nhân viên / phòng ban con / chức vụ tham chiếu thì trả 422.',
  })
  @ApiOkResponse({ type: DeleteResponseDto })
  @ApiNotFoundResponse({ description: 'DEPARTMENT_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    description:
      'DEPARTMENT_HAS_EMPLOYEES / DEPARTMENT_HAS_CHILDREN / DEPARTMENT_HAS_POSITIONS',
  })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – role không được ghi' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<DeleteResponseDto> {
    return this.departmentsService.remove(id);
  }
}
