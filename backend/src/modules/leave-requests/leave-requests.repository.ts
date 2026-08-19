import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  LeaveRequest,
  LeaveRequestStatus,
} from '@/modules/leaves/entities/leave-request.entity';
import { LeaveRequestSortKey } from './dto/filter-leave-request.dto';

/** Map `sort` (whitelist ở FilterLeaveRequestDto) → cột SQL an toàn. */
const SORT_COLUMNS: Record<LeaveRequestSortKey, string> = {
  startDate: 'request.startDate',
  createdAt: 'request.createdAt',
  totalDays: 'request.totalDays',
};

/**
 * Trạng thái CÒN GIỮ CHỖ trên lịch nghỉ của nhân viên.
 *
 * Đơn bị từ chối hoặc đã huỷ không chiếm ngày nào, nên chúng không tham gia vào
 * kiểm tra trùng ngày — nếu tính vào thì một đơn bị từ chối sẽ chặn luôn đơn
 * nộp lại của chính nó.
 */
export const ACTIVE_LEAVE_STATUSES = [
  LeaveRequestStatus.PENDING,
  LeaveRequestStatus.APPROVED,
];

export interface FindLeaveRequestsOptions {
  skip: number;
  take: number;
  sort: LeaveRequestSortKey;
  order: 'ASC' | 'DESC';
  employeeId?: number;
  departmentId?: number;
  leaveTypeId?: number;
  status?: LeaveRequestStatus;
  /** Kỳ nghỉ GIAO NHAU với khoảng này, không phải chỉ bắt đầu trong khoảng. */
  overlapping?: { from: string; to: string };
  departmentScope?: number[];
}

/** Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module). */
@Injectable()
export class LeaveRequestsRepository {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly repository: Repository<LeaveRequest>,
  ) {}

  findPaginated(
    options: FindLeaveRequestsOptions,
  ): Promise<[LeaveRequest[], number]> {
    const query = this.repository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .innerJoinAndSelect('request.leaveType', 'leaveType')
      .leftJoinAndSelect('request.approver', 'approver')
      .leftJoinAndSelect('request.recorder', 'recorder')
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

    if (options.leaveTypeId !== undefined) {
      query.andWhere('request.leaveTypeId = :leaveTypeId', {
        leaveTypeId: options.leaveTypeId,
      });
    }

    if (options.status !== undefined) {
      query.andWhere('request.status = :status', { status: options.status });
    }

    if (options.overlapping) {
      /*
       * GIAO NHAU, không phải "bắt đầu trong khoảng": một kỳ nghỉ từ 28/04 đến
       * 03/05 vẫn phải hiện khi xem tháng 5. Lọc theo `start_date` thôi sẽ giấu
       * mất đúng những kỳ nghỉ bắc qua đầu tháng.
       */
      query.andWhere('request.startDate <= :to AND request.endDate >= :from', {
        from: options.overlapping.from,
        to: options.overlapping.to,
      });
    }

    if (options.departmentScope) {
      // Mảng rỗng = không quản phòng nào → không thấy dòng nào.
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

  findById(id: number): Promise<LeaveRequest | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        employee: { department: true },
        leaveType: true,
        approver: true,
        recorder: true,
      },
    });
  }

  /** Các đơn còn hiệu lực của một nhân viên giao nhau với khoảng ngày. */
  findActiveOverlapping(
    employeeId: number,
    from: string,
    to: string,
  ): Promise<LeaveRequest[]> {
    return this.repository
      .createQueryBuilder('request')
      .where('request.employeeId = :employeeId', { employeeId })
      .andWhere('request.status IN (:...statuses)', {
        statuses: ACTIVE_LEAVE_STATUSES,
      })
      .andWhere('request.startDate <= :to AND request.endDate >= :from', {
        from,
        to,
      })
      .orderBy('request.startDate', 'ASC')
      .getMany();
  }

  /** Đơn ĐÃ DUYỆT giao nhau với khoảng ngày — dùng cho lịch "ai đang nghỉ". */
  findApprovedInRange(
    from: string,
    to: string,
    departmentScope?: number[],
  ): Promise<LeaveRequest[]> {
    const query = this.repository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .innerJoinAndSelect('request.leaveType', 'leaveType')
      .where('request.status = :status', {
        status: LeaveRequestStatus.APPROVED,
      })
      .andWhere('request.startDate <= :to AND request.endDate >= :from', {
        from,
        to,
      })
      .orderBy('request.startDate', 'ASC')
      .addOrderBy('employee.fullName', 'ASC');

    if (departmentScope) {
      if (departmentScope.length === 0) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('employee.departmentId IN (:...departmentScope)', {
          departmentScope,
        });
      }
    }

    return query.getMany();
  }

  countByLeaveTypeIds(leaveTypeIds: number[]): Promise<number> {
    if (leaveTypeIds.length === 0) {
      return Promise.resolve(0);
    }

    return this.repository.count({ where: { leaveTypeId: In(leaveTypeIds) } });
  }

  create(request: Partial<LeaveRequest>): Promise<LeaveRequest> {
    return this.repository.save(this.repository.create(request));
  }

  save(request: LeaveRequest): Promise<LeaveRequest> {
    return this.repository.save(request);
  }
}
