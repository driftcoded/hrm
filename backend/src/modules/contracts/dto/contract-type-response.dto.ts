import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '../entities/contract.entity';

/** A contract type (a value of the `contracts.contract_type` enum). */
export class ContractTypeResponseDto {
  @ApiProperty({ enum: ContractType, example: ContractType.FIXED_TERM })
  value: ContractType;

  @ApiProperty({ example: 'Hợp đồng lao động xác định thời hạn' })
  label: string;

  @ApiProperty({
    example: 'Điều 20.1.b BLLĐ 2019 – thời hạn tối đa 36 tháng',
    description: 'Căn cứ pháp lý / ghi chú ngắn cho HR',
  })
  description: string;
}
