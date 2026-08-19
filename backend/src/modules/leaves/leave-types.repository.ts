import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { findMaxCodeNumber } from '@/common/utils/sequential-code.util';
import { LeaveBalance } from '@/modules/leave-balances/entities/leave-balance.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveApplicableGender, LeaveType } from './entities/leave-type.entity';

export interface FindLeaveTypesOptions {
  isActive?: boolean;
  applicableGender?: LeaveApplicableGender;
}

/** TypeORM queries only (CLAUDE.md §Module architecture). */
@Injectable()
export class LeaveTypesRepository {
  constructor(
    @InjectRepository(LeaveType)
    private readonly repository: Repository<LeaveType>,
    // Counts references before deletion – leave_types has NO deleted_at
    // column, so a delete is permanent; we must confirm no leave request /
    // leave balance still points to this row.
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepository: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepository: Repository<LeaveBalance>,
  ) {}

  findAll(options: FindLeaveTypesOptions): Promise<LeaveType[]> {
    const query = this.repository
      .createQueryBuilder('leaveType')
      .orderBy('leaveType.sortOrder', 'ASC')
      .addOrderBy('leaveType.id', 'ASC');

    if (options.isActive !== undefined) {
      query.andWhere('leaveType.isActive = :isActive', {
        isActive: options.isActive,
      });
    }

    if (options.applicableGender !== undefined) {
      query.andWhere('leaveType.applicableGender = :applicableGender', {
        applicableGender: options.applicableGender,
      });
    }

    return query.getMany();
  }

  findById(id: number): Promise<LeaveType | null> {
    return this.repository
      .createQueryBuilder('leaveType')
      .where('leaveType.id = :id', { id })
      .getOne();
  }

  countLeaveRequests(leaveTypeId: number): Promise<number> {
    return this.leaveRequestRepository
      .createQueryBuilder('leaveRequest')
      .where('leaveRequest.leaveTypeId = :leaveTypeId', { leaveTypeId })
      .getCount();
  }

  countLeaveBalances(leaveTypeId: number): Promise<number> {
    return this.leaveBalanceRepository
      .createQueryBuilder('leaveBalance')
      .where('leaveBalance.leaveTypeId = :leaveTypeId', { leaveTypeId })
      .getCount();
  }

  /**
   * Highest number issued for generated `NP####` codes.
   *
   * `leave_types` has no `deleted_at` (schema §5.2) — rows are removed for real,
   * so there is nothing extra to include here. The statutory seed codes
   * (`ANNUAL`, `SICK`, …) do not match the generated pattern and are ignored.
   */
  findMaxCodeNumber(prefix: string): Promise<number> {
    return findMaxCodeNumber(
      this.repository,
      'leaveType',
      'code',
      prefix,
      false,
    );
  }

  create(data: Partial<LeaveType>): Promise<LeaveType> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: Partial<LeaveType>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  /** Hard delete: the `leave_types` table has no `deleted_at` column (schema §5.2). */
  async delete(id: number): Promise<void> {
    await this.repository.delete({ id });
  }
}
