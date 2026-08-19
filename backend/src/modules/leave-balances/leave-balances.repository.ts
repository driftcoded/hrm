import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LeaveBalanceSortKey } from './dto/filter-leave-balance.dto';
import { LeaveBalance } from './entities/leave-balance.entity';

/** Map `sort` (whitelist ở FilterLeaveBalanceDto) → cột SQL an toàn. */
const SORT_COLUMNS: Record<LeaveBalanceSortKey, string> = {
  year: 'balance.year',
  remainingDays: 'balance.remainingDays',
};

export interface FindLeaveBalancesOptions {
  skip: number;
  take: number;
  sort: LeaveBalanceSortKey;
  order: 'ASC' | 'DESC';
  year: number;
  employeeId?: number;
  departmentId?: number;
  leaveTypeId?: number;
  /** Giới hạn theo phòng ban – role `manager` (architecture.md §7.3). */
  departmentScope?: number[];
}

/** Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module). */
@Injectable()
export class LeaveBalancesRepository {
  constructor(
    @InjectRepository(LeaveBalance)
    private readonly repository: Repository<LeaveBalance>,
  ) {}

  findPaginated(
    options: FindLeaveBalancesOptions,
  ): Promise<[LeaveBalance[], number]> {
    const query = this.repository
      .createQueryBuilder('balance')
      .innerJoinAndSelect('balance.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .innerJoinAndSelect('balance.leaveType', 'leaveType')
      .where('balance.year = :year', { year: options.year })
      .orderBy(SORT_COLUMNS[options.sort], options.order)
      // Khoá thứ tự phụ để hai lần gọi cùng tham số không đảo dòng cho nhau.
      .addOrderBy('balance.id', 'ASC')
      .skip(options.skip)
      .take(options.take);

    if (options.employeeId !== undefined) {
      query.andWhere('balance.employeeId = :employeeId', {
        employeeId: options.employeeId,
      });
    }

    if (options.departmentId !== undefined) {
      query.andWhere('employee.departmentId = :departmentId', {
        departmentId: options.departmentId,
      });
    }

    if (options.leaveTypeId !== undefined) {
      query.andWhere('balance.leaveTypeId = :leaveTypeId', {
        leaveTypeId: options.leaveTypeId,
      });
    }

    if (options.departmentScope) {
      // Mảng rỗng = không quản phòng nào → không thấy dòng nào. Bỏ qua điều
      // kiện sẽ biến "không có quyền" thành "thấy tất cả".
      if (options.departmentScope.length === 0) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('employee.departmentId IN (:...departmentScope)', {
          departmentScope: options.departmentScope,
        });
      }
    }

    return query.getManyAndCount();
  }

  findById(id: number): Promise<LeaveBalance | null> {
    return this.repository.findOne({
      where: { id },
      relations: { employee: { department: true }, leaveType: true },
    });
  }

  /** Quỹ phép của một nhân viên cho một loại phép trong một năm. */
  findOneFor(
    employeeId: number,
    leaveTypeId: number,
    year: number,
  ): Promise<LeaveBalance | null> {
    return this.repository.findOne({
      where: { employeeId, leaveTypeId, year },
    });
  }

  /** Những nhân viên ĐÃ CÓ quỹ phép của loại này trong năm — dùng cho bước khởi tạo. */
  async findEmployeeIdsWithBalance(
    leaveTypeId: number,
    year: number,
    employeeIds: number[],
  ): Promise<Set<number>> {
    if (employeeIds.length === 0) {
      return new Set();
    }

    const rows = await this.repository.find({
      where: { leaveTypeId, year, employeeId: In(employeeIds) },
      select: { employeeId: true },
    });

    return new Set(rows.map((row) => Number(row.employeeId)));
  }

  /** Quỹ phép năm trước của một nhóm nhân viên — để tính chuyển phép. */
  async findRemainingByEmployee(
    leaveTypeId: number,
    year: number,
    employeeIds: number[],
  ): Promise<Map<number, number>> {
    if (employeeIds.length === 0) {
      return new Map();
    }

    const rows = await this.repository.find({
      where: { leaveTypeId, year, employeeId: In(employeeIds) },
    });

    return new Map(
      rows.map((row) => [Number(row.employeeId), Number(row.remainingDays)]),
    );
  }

  createMany(balances: Partial<LeaveBalance>[]): Promise<LeaveBalance[]> {
    return this.repository.save(this.repository.create(balances));
  }

  remove(id: number): Promise<unknown> {
    return this.repository.delete(id);
  }

  save(balance: LeaveBalance): Promise<LeaveBalance> {
    return this.repository.save(balance);
  }
}
