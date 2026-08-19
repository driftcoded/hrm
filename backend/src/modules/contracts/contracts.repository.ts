import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { ContractSortKey } from './dto/filter-contract.dto';
import {
  Contract,
  ContractStatus,
  ContractType,
} from './entities/contract.entity';

/** Map `sort` (whitelist ở FilterContractDto) → cột SQL an toàn. */
const SORT_COLUMNS: Record<ContractSortKey, string> = {
  contractNumber: 'contract.contractNumber',
  startDate: 'contract.startDate',
  endDate: 'contract.endDate',
  createdAt: 'contract.createdAt',
};

export interface FindContractsOptions {
  skip: number;
  take: number;
  sort: ContractSortKey;
  order: 'ASC' | 'DESC';
  employeeId?: number;
  status?: ContractStatus;
  contractType?: ContractType;
  search?: string;
  /** Lọc hợp đồng có `end_date` nằm trong [today, today + expiringDays]. */
  expiring?: { from: string; to: string };
  /** Giới hạn theo phòng ban – role `manager` (architecture.md §7.3). */
  departmentScope?: number[];
}

/**
 * Chỉ chứa TypeORM query, không có if/else nghiệp vụ (CLAUDE.md §Kiến trúc
 * module).
 *
 * Bảng `contracts` KHÔNG có `deleted_at` (database-schema.md §4.1) nên không
 * có xoá mềm ở đây — xem ContractsService.remove để biết vì sao chỉ hợp đồng
 * `draft` mới xoá được.
 */
@Injectable()
export class ContractsRepository {
  constructor(
    @InjectRepository(Contract)
    private readonly repository: Repository<Contract>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  findPaginated(options: FindContractsOptions): Promise<[Contract[], number]> {
    const query = this.repository
      .createQueryBuilder('contract')
      .innerJoinAndSelect('contract.employee', 'employee')
      .orderBy(SORT_COLUMNS[options.sort], options.order)
      .addOrderBy('contract.id', 'DESC')
      .skip(options.skip)
      .take(options.take);

    if (options.departmentScope) {
      if (options.departmentScope.length === 0) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('employee.departmentId IN (:...departmentScope)', {
          departmentScope: options.departmentScope,
        });
      }
    }

    if (options.employeeId !== undefined) {
      query.andWhere('contract.employeeId = :employeeId', {
        employeeId: options.employeeId,
      });
    }

    if (options.status !== undefined) {
      query.andWhere('contract.status = :status', { status: options.status });
    }

    if (options.contractType !== undefined) {
      query.andWhere('contract.contractType = :contractType', {
        contractType: options.contractType,
      });
    }

    if (options.expiring) {
      query
        .andWhere('contract.endDate IS NOT NULL')
        .andWhere('contract.endDate BETWEEN :expiringFrom AND :expiringTo', {
          expiringFrom: options.expiring.from,
          expiringTo: options.expiring.to,
        });
    }

    if (options.search) {
      query.andWhere(
        '(contract.contractNumber LIKE :search OR employee.fullName LIKE :search OR employee.employeeCode LIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    return query.getManyAndCount();
  }

  findById(id: number): Promise<Contract | null> {
    return this.repository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.employee', 'employee')
      .where('contract.id = :id', { id })
      .getOne();
  }

  findByContractNumber(contractNumber: string): Promise<Contract | null> {
    return this.repository
      .createQueryBuilder('contract')
      .where('contract.contractNumber = :contractNumber', { contractNumber })
      .getOne();
  }

  /** Hợp đồng đang hiệu lực của một nhân viên (mỗi người tối đa 1). */
  findActiveByEmployee(employeeId: number): Promise<Contract | null> {
    return this.repository
      .createQueryBuilder('contract')
      .where('contract.employeeId = :employeeId', { employeeId })
      .andWhere('contract.status = :status', { status: ContractStatus.ACTIVE })
      .orderBy('contract.startDate', 'DESC')
      .getOne();
  }

  /**
   * Đếm hợp đồng XĐTH đã ký của một nhân viên – dùng cho giới hạn 2 lần của
   * Điều 20.2 BLLĐ 2019. Hợp đồng `draft` không tính vì chưa ký thật.
   */
  countSignedFixedTerm(
    employeeId: number,
    excludeId?: number,
  ): Promise<number> {
    const query = this.repository
      .createQueryBuilder('contract')
      .where('contract.employeeId = :employeeId', { employeeId })
      .andWhere('contract.contractType = :contractType', {
        contractType: ContractType.FIXED_TERM,
      })
      .andWhere('contract.status <> :draft', { draft: ContractStatus.DRAFT });

    if (excludeId !== undefined) {
      query.andWhere('contract.id <> :excludeId', { excludeId });
    }

    return query.getCount();
  }

  findEmployeeById(id: number): Promise<Employee | null> {
    return this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.id = :id', { id })
      .getOne();
  }

  create(data: Partial<Contract>): Promise<Contract> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: Partial<Contract>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete({ id });
  }
}
