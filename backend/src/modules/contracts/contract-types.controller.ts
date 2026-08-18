import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { ContractTypesService } from './contract-types.service';
import { ContractTypeResponseDto } from './dto/contract-type-response.dto';

/**
 * `GET /contract-types` – read-only; any authenticated role can read it (used
 * to populate the dropdown when creating a contract). No POST/PATCH/DELETE:
 * see ContractTypesService for why (a legally-defined enum, not master data).
 *
 * This endpoint is NOT in api-spec.md – added in Phase 2.1.
 */
@ApiTags('Contract Types')
@Controller('contract-types')
export class ContractTypesController {
  constructor(private readonly contractTypesService: ContractTypesService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách loại hợp đồng (enum, read-only)',
    description:
      '4 giá trị của `contracts.contract_type` kèm nhãn tiếng Việt + căn cứ pháp lý. Không có endpoint tạo/sửa/xoá.',
  })
  @ApiOkResponse({ type: [ContractTypeResponseDto] })
  findAll(): ContractTypeResponseDto[] {
    return this.contractTypesService.findAll();
  }
}
