import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AttendanceSortKey } from './dto/filter-attendance.dto';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

/** Map `sort` (whitelist ở FilterAttendanceDto) → cột SQL an toàn. */
const SORT_COLUMNS: Record<AttendanceSortKey, string> = {
  workDate: 'attendance.workDate',
  checkIn: 'attendance.checkIn',
  workHours: 'attendance.workHours',
};

/** Một ô của phép GROUP BY (ngày × trạng thái); số trả về dạng chuỗi, ép kiểu ở service. */
export interface AttendanceAggregateRow {
  date: string | Date;
  status: AttendanceStatus;
  count: string;
  workHours: string;
  overtimeHours: string;
}

/** Điều kiện WHERE dùng chung cho cả truy vấn phân trang và truy vấn tổng hợp. */
export interface AttendanceFilterOptions {
  employeeId?: number;
  departmentId?: number;
  status?: AttendanceStatus;
  /** Khoảng ngày `YYYY-MM-DD`, đã tính sẵn từ `month`/`year` ở tầng service. */
  dateRange?: { from: string; to: string };
  /** Giới hạn theo phòng ban – role `manager` (architecture.md §7.3). */
  departmentScope?: number[];
}

export interface FindAttendancesOptions extends AttendanceFilterOptions {
  skip: number;
  take: number;
  sort: AttendanceSortKey;
  order: 'ASC' | 'DESC';
}

/**
 * Chỉ chứa TypeORM query, không có if/else nghiệp vụ (CLAUDE.md §Kiến trúc module).
 *
 * Bảng `attendances` KHÔNG có xoá mềm: một ngày công đã ghi thì hoặc được sửa
 * (có lý do, qua PATCH) hoặc giữ nguyên. Ẩn đi một ngày công mà vẫn giữ trong
 * DB sẽ tạo ra hai phiên bản bảng công cho cùng một tháng.
 */
@Injectable()
export class AttendancesRepository {
  constructor(
    @InjectRepository(Attendance)
    private readonly repository: Repository<Attendance>,
  ) {}

  findPaginated(
    options: FindAttendancesOptions,
  ): Promise<[Attendance[], number]> {
    const query = this.repository
      .createQueryBuilder('attendance')
      .innerJoinAndSelect('attendance.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .orderBy(SORT_COLUMNS[options.sort], options.order)
      // Khoá thứ tự phụ để hai lần gọi cùng tham số không đảo dòng cho nhau
      // — thiếu nó thì phân trang có thể trả trùng/thiếu bản ghi.
      .addOrderBy('attendance.id', 'DESC')
      .skip(options.skip)
      .take(options.take);

    this.applyFilters(query, options);

    return query.getManyAndCount();
  }

  /** Đếm bản ghi và cộng giờ, gộp theo (ngày, trạng thái). Không nhận `status`. */
  aggregateByDateAndStatus(
    options: Omit<AttendanceFilterOptions, 'status'>,
  ): Promise<AttendanceAggregateRow[]> {
    const query = this.repository
      .createQueryBuilder('attendance')
      // Join chỉ để lọc theo phòng ban, không lấy cột nào của employees.
      .innerJoin('attendance.employee', 'employee')
      .select('attendance.workDate', 'date')
      .addSelect('attendance.status', 'status')
      .addSelect('COUNT(*)', 'count')
      // COALESCE: một ngày mà `work_hours` toàn NULL thì SUM trả về NULL.
      .addSelect('COALESCE(SUM(attendance.workHours), 0)', 'workHours')
      .addSelect('COALESCE(SUM(attendance.overtimeHours), 0)', 'overtimeHours')
      .groupBy('attendance.workDate')
      .addGroupBy('attendance.status')
      .orderBy('attendance.workDate', 'ASC');

    this.applyFilters(query, options);

    return query.getRawMany<AttendanceAggregateRow>();
  }

  /** Bản ghi chấm công của một nhân viên trong một ngày, nếu có. */
  findByEmployeeAndDate(
    employeeId: number,
    workDate: string,
  ): Promise<Attendance | null> {
    return this.repository.findOne({ where: { employeeId, workDate } });
  }

  findById(id: number): Promise<Attendance | null> {
    return this.repository.findOne({
      where: { id },
      relations: { employee: { department: true } },
    });
  }

  /** Toàn bộ ngày công của một nhân viên trong khoảng ngày, sắp theo ngày tăng dần. */
  findByEmployeeInRange(
    employeeId: number,
    from: string,
    to: string,
  ): Promise<Attendance[]> {
    return this.repository.find({
      where: { employeeId, workDate: Between(from, to) },
      order: { workDate: 'ASC' },
    });
  }

  create(attendance: Partial<Attendance>): Promise<Attendance> {
    return this.repository.save(this.repository.create(attendance));
  }

  save(attendance: Attendance): Promise<Attendance> {
    return this.repository.save(attendance);
  }

  private applyFilters(
    query: ReturnType<Repository<Attendance>['createQueryBuilder']>,
    options: AttendanceFilterOptions,
  ): void {
    if (options.employeeId !== undefined) {
      query.andWhere('attendance.employeeId = :employeeId', {
        employeeId: options.employeeId,
      });
    }

    if (options.departmentId !== undefined) {
      query.andWhere('employee.departmentId = :departmentId', {
        departmentId: options.departmentId,
      });
    }

    if (options.status !== undefined) {
      query.andWhere('attendance.status = :status', { status: options.status });
    }

    if (options.dateRange) {
      query.andWhere('attendance.workDate BETWEEN :from AND :to', {
        from: options.dateRange.from,
        to: options.dateRange.to,
      });
    }

    if (options.departmentScope) {
      /*
       * Mảng rỗng nghĩa là "không quản phòng nào" → không thấy dòng nào.
       * Bỏ qua điều kiện khi mảng rỗng sẽ biến nó thành "thấy tất cả", tức là
       * cấp quyền do không có quyền — `IN ()` cũng là lỗi cú pháp SQL.
       */
      if (options.departmentScope.length === 0) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('employee.departmentId IN (:...departmentScope)', {
          departmentScope: options.departmentScope,
        });
      }
    }
  }
}
