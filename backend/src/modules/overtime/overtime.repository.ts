import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { OvertimeSortKey } from './dto/filter-overtime.dto';
import {
  OvertimeRequest,
  OvertimeRequestStatus,
} from './entities/overtime-request.entity';

/** Map `sort` (whitelist ở FilterOvertimeDto) → cột SQL an toàn. */
const SORT_COLUMNS: Record<OvertimeSortKey, string> = {
  workDate: 'request.workDate',
  createdAt: 'request.createdAt',
  totalHours: 'request.totalHours',
};

/**
 * Trạng thái CÒN GIỮ CHỖ trên lịch của nhân viên.
 *
 * Đơn bị từ chối hoặc đã huỷ không chiếm giờ nào, nên chúng không tham gia vào
 * kiểm tra trùng giờ lẫn cộng dồn trần Điều 107 — nếu tính vào thì một đơn bị
 * từ chối sẽ chặn luôn đơn nộp lại của chính nó.
 */
export const ACTIVE_OVERTIME_STATUSES = [
  OvertimeRequestStatus.PENDING,
  OvertimeRequestStatus.APPROVED,
];

export interface FindOvertimeOptions {
  skip: number;
  take: number;
  sort: OvertimeSortKey;
  order: 'ASC' | 'DESC';
  employeeId?: number;
  departmentId?: number;
  status?: OvertimeRequestStatus;
  dateRange?: { from: string; to: string };
  departmentScope?: number[];
}

/** Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module). */
@Injectable()
export class OvertimeRepository {
  constructor(
    @InjectRepository(OvertimeRequest)
    private readonly repository: Repository<OvertimeRequest>,
  ) {}

  findPaginated(
    options: FindOvertimeOptions,
  ): Promise<[OvertimeRequest[], number]> {
    const query = this.repository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('request.approver', 'approver')
      .orderBy(SORT_COLUMNS[options.sort], options.order)
      .addOrderBy('request.id', 'DESC')
      .skip(options.skip)
      .take(options.take);

    if (options.employeeId !== undefined) {
      query.andWhere('request.employeeId = :employeeId', {
        employeeId: options.employeeId,
      });
    }

    if (options.departmentId !== undefined) {
      query.andWhere('employee.departmentId = :departmentId', {
        departmentId: options.departmentId,
      });
    }

    if (options.status !== undefined) {
      query.andWhere('request.status = :status', { status: options.status });
    }

    if (options.dateRange) {
      query.andWhere('request.workDate BETWEEN :from AND :to', {
        from: options.dateRange.from,
        to: options.dateRange.to,
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

  findById(id: number): Promise<OvertimeRequest | null> {
    return this.repository.findOne({
      where: { id },
      relations: { employee: { department: true }, approver: true },
    });
  }

  /** Các đơn còn hiệu lực của một nhân viên trong một ngày — để kiểm tra trùng giờ. */
  findActiveByEmployeeAndDate(
    employeeId: number,
    workDate: string,
  ): Promise<OvertimeRequest[]> {
    return this.repository.find({
      where: {
        employeeId,
        workDate,
        status: In(ACTIVE_OVERTIME_STATUSES),
      },
      order: { startTime: 'ASC' },
    });
  }

  /** Các đơn còn hiệu lực trong một khoảng ngày — để cộng dồn trần tháng/năm. */
  findActiveByEmployeeInRange(
    employeeId: number,
    from: string,
    to: string,
  ): Promise<OvertimeRequest[]> {
    return this.repository.find({
      where: {
        employeeId,
        workDate: Between(from, to),
        status: In(ACTIVE_OVERTIME_STATUSES),
      },
    });
  }

  /** Tổng giờ ĐÃ DUYỆT trong khoảng ngày — căn cứ trả tiền làm thêm. */
  async sumApprovedHours(
    employeeId: number,
    from: string,
    to: string,
  ): Promise<number> {
    const result: { total: string | null } | undefined = await this.repository
      .createQueryBuilder('request')
      .select('SUM(request.totalHours)', 'total')
      .where('request.employeeId = :employeeId', { employeeId })
      .andWhere('request.workDate BETWEEN :from AND :to', { from, to })
      .andWhere('request.status = :status', {
        status: OvertimeRequestStatus.APPROVED,
      })
      .getRawOne();

    // SUM trên tập rỗng trả NULL, không phải 0.
    return Number(result?.total ?? 0);
  }

  create(request: Partial<OvertimeRequest>): Promise<OvertimeRequest> {
    return this.repository.save(this.repository.create(request));
  }

  save(request: OvertimeRequest): Promise<OvertimeRequest> {
    return this.repository.save(request);
  }
}
