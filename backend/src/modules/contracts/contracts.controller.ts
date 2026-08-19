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
import { CONTRACT_WRITE_ROLES } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { DeleteResponseDto } from '@/common/dto/delete-response.dto';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { ContractsService } from './contracts.service';
import { ContractResponseDto } from './dto/contract-response.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { FilterContractDto } from './dto/filter-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module).
 *
 * ĐỌC không khai báo `@Roles()`: phạm vi dữ liệu do ContractsService quyết
 * định theo hồ sơ nhân viên (nhân viên chỉ thấy hợp đồng của mình, manager
 * thấy phòng ban mình). GHI chỉ admin/hr_manager (api-spec.md §6).
 */
@ApiTags('Contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách hợp đồng lao động',
    description:
      'Lọc theo `employeeId`, `status`, `contractType`, `expiringDays` (hợp đồng hết hạn trong N ngày tới). ' +
      'Nhân viên thường chỉ nhận được hợp đồng của chính mình.',
  })
  @ApiOkResponse({ type: [ContractResponseDto] })
  findAll(
    @Query() filter: FilterContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ContractResponseDto>> {
    return this.contractsService.findAll(filter, user);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một hợp đồng' })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundResponse({ description: 'CONTRACT_NOT_FOUND' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – ngoài phạm vi của role' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractsService.findOne(id, user);
  }

  @Post()
  @Roles(...CONTRACT_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Tạo hợp đồng cho một nhân viên',
    description:
      'Kiểm tra quy tắc BLLĐ 2019: HĐ không xác định thời hạn không có endDate, HĐ xác định thời hạn ≤ 36 tháng và tối đa 2 lần, thử việc ≤ 180 ngày.',
  })
  @ApiCreatedResponse({ type: ContractResponseDto })
  @ApiConflictResponse({
    description: 'DUPLICATE_CONTRACT_NUMBER / CONTRACT_ALREADY_ACTIVE',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'EMPLOYEE_NOT_FOUND / INVALID_CONTRACT_PERIOD / INVALID_SIGN_DATE / INVALID_CONTRACT_STATUS / CONTRACT_TYPE_LIMIT',
  })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin / hr_manager' })
  create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    return this.contractsService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(...CONTRACT_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật hợp đồng (partial update)' })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundResponse({ description: 'CONTRACT_NOT_FOUND' })
  @ApiConflictResponse({
    description: 'DUPLICATE_CONTRACT_NUMBER / CONTRACT_ALREADY_ACTIVE',
  })
  @ApiUnprocessableEntityResponse({
    description: 'CONTRACT_ALREADY_TERMINATED / INVALID_CONTRACT_PERIOD',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
  ): Promise<ContractResponseDto> {
    return this.contractsService.update(id, dto);
  }

  @Patch(':id/terminate')
  @Roles(...CONTRACT_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Chấm dứt hợp đồng trước hạn (api-spec.md §6)',
    description:
      'Đặt status = terminated kèm ngày và lý do. Hợp đồng draft thì xoá chứ không chấm dứt.',
  })
  @ApiOkResponse({ type: ContractResponseDto })
  @ApiNotFoundResponse({ description: 'CONTRACT_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    description:
      'CONTRACT_ALREADY_TERMINATED / CONTRACT_NOT_SIGNED / INVALID_DATE_RANGE',
  })
  terminate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TerminateContractDto,
  ): Promise<ContractResponseDto> {
    return this.contractsService.terminate(id, dto);
  }

  @Delete(':id')
  @Roles(...CONTRACT_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá hợp đồng nháp',
    description:
      'Bảng `contracts` không có xoá mềm nên đây là xoá vật lý — CHỈ áp dụng cho hợp đồng status=draft. Hợp đồng đã ký phải dùng /terminate.',
  })
  @ApiOkResponse({ type: DeleteResponseDto })
  @ApiNotFoundResponse({ description: 'CONTRACT_NOT_FOUND' })
  @ApiUnprocessableEntityResponse({
    description: 'CONTRACT_NOT_DELETABLE – hợp đồng đã ký',
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<DeleteResponseDto> {
    return this.contractsService.remove(id);
  }
}
