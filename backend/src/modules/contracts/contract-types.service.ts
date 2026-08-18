import { Injectable } from '@nestjs/common';
import { ContractTypeResponseDto } from './dto/contract-type-response.dto';
import { ContractType } from './entities/contract.entity';

/**
 * Contract type is an **enum** (`contracts.contract_type`), NOT a database
 * table: the 26-table schema has no `contract_types` table, and these 4
 * values are defined by the 2019 Labor Code (BLLĐ 2019) — each type carries
 * different social-insurance / probation / notice-period rules. That is why
 * this endpoint is READ-ONLY: HR cannot add new types themselves, since the
 * payroll and contract logic would not know how to handle them.
 *
 * No repository here, because there is no table to query.
 */
@Injectable()
export class ContractTypesService {
  /**
   * ⚠️ Legal note: Article 20 (Điều 20) of the 2019 Labor Code (BLLĐ 2019)
   * recognizes only **2** contract types (indefinite-term / fixed-term ≤ 36
   * months). `probation` (a probation agreement – Điều 24–27) and `seasonal`
   * (a contract type from the 2012 Labor Code, now repealed) still exist in
   * the schema's enum so that legacy data can still be read; the
   * label/description spell out the legal basis so HR does not misuse them.
   */
  private readonly contractTypes: ContractTypeResponseDto[] = [
    {
      value: ContractType.PROBATION,
      label: 'Hợp đồng thử việc',
      description:
        'Thoả thuận thử việc – Điều 24÷27 BLLĐ 2019. Thời gian thử việc tối đa 180 ngày (quản lý doanh nghiệp) / 60 ngày (trình độ cao đẳng trở lên) / 30 ngày / 6 ngày làm việc; lương ≥ 85% lương của công việc đó.',
    },
    {
      value: ContractType.FIXED_TERM,
      label: 'Hợp đồng lao động xác định thời hạn',
      description:
        'Điều 20.1.b BLLĐ 2019 – thời hạn tối đa 36 tháng. Chỉ được ký tối đa 2 lần liên tiếp, lần thứ 3 phải chuyển sang không xác định thời hạn.',
    },
    {
      value: ContractType.INDEFINITE,
      label: 'Hợp đồng lao động không xác định thời hạn',
      description:
        'Điều 20.1.a BLLĐ 2019 – không xác định thời điểm chấm dứt hiệu lực.',
    },
    {
      value: ContractType.SEASONAL,
      label: 'Hợp đồng theo mùa vụ / công việc nhất định',
      description:
        'Loại hợp đồng của BLLĐ 2012 (Điều 22.1.c), đã bị BLLĐ 2019 bãi bỏ – chỉ dùng để đọc dữ liệu lịch sử, không ký mới.',
    },
  ];

  /** Fixed list, not paginated (only 4 entries). */
  findAll(): ContractTypeResponseDto[] {
    return this.contractTypes;
  }
}
