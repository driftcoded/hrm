import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Attendance } from '@/modules/attendances/entities/attendance.entity';
import { Contract } from '@/modules/contracts/entities/contract.entity';
import { Employee } from '@/modules/employees/entities/employee.entity';
import {
  SalaryAdvance,
  SalaryAdvanceStatus,
} from './entities/salary-advance.entity';
import { Salary } from './entities/salary.entity';

/**
 * Truy vấn HÀNG LOẠT cho một kỳ lương.
 *
 * Tính lương chạm vào cả công ty trong một lần bấm. Hỏi từng nhân viên một
 * (hợp đồng, chấm công, người phụ thuộc, tạm ứng) là 5 query × 200 người =
 * 1000 vòng đi–về database cho một lần tính. Ở đây mỗi thứ đúng MỘT query cho
 * cả kỳ, service tự ghép theo `employeeId`.
 *
 * Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module).
 */
@Injectable()
export class PayrollRepository {
  constructor(
    @InjectRepository(Salary)
    private readonly salaries: Repository<Salary>,
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(Attendance)
    private readonly attendances: Repository<Attendance>,
    @InjectRepository(SalaryAdvance)
    private readonly advances: Repository<SalaryAdvance>,
  ) {}

  /**
   * Nhân viên được tính lương của kỳ.
   *
   * `resigned`/`terminated` bị loại: người đã nghỉ việc không có lương tháng
   * này. `on_leave` và `suspended` VẪN được tính — nghỉ dài hạn hay tạm đình chỉ
   * vẫn có thể phát sinh lương theo ngày công thực tế, và để họ rơi ra ngoài thì
   * kế toán không có dòng nào để chỉnh.
   */
  findPayableEmployees(): Promise<Employee[]> {
    return this.employees
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.department', 'department')
      .where('employee.status IN (:...statuses)', {
        statuses: ['probation', 'active', 'on_leave', 'suspended'],
      })
      .orderBy('employee.employeeCode', 'ASC')
      .getMany();
  }

  /**
   * Hợp đồng CÒN HIỆU LỰC trong kỳ lương, cho nhiều nhân viên một lượt.
   *
   * "Còn hiệu lực trong kỳ" chứ không phải "đang hiệu lực hôm nay": tính lại
   * bảng lương tháng 3 vào tháng 12 phải lấy hợp đồng của tháng 3. Một người có
   * thể có nhiều hợp đồng chồng lấn kỳ (ký mới giữa tháng) — lấy hợp đồng bắt
   * đầu MUỘN NHẤT, tức bản mới nhất còn hiệu lực.
   */
  async findActiveContracts(
    employeeIds: number[],
    periodStart: string,
    periodEnd: string,
  ): Promise<Map<number, Contract>> {
    if (employeeIds.length === 0) {
      return new Map();
    }

    const rows = await this.contracts
      .createQueryBuilder('contract')
      .where('contract.employeeId IN (:...employeeIds)', { employeeIds })
      .andWhere('contract.status = :status', { status: 'active' })
      .andWhere('contract.startDate <= :periodEnd', { periodEnd })
      .andWhere(
        '(contract.endDate IS NULL OR contract.endDate >= :periodStart)',
        { periodStart },
      )
      .orderBy('contract.startDate', 'ASC')
      .getMany();

    const byEmployee = new Map<number, Contract>();

    for (const row of rows) {
      byEmployee.set(Number(row.employeeId), row);
    }

    return byEmployee;
  }

  async findAttendanceInPeriod(
    employeeIds: number[],
    from: string,
    to: string,
  ): Promise<Map<number, Attendance[]>> {
    if (employeeIds.length === 0) {
      return new Map();
    }

    const rows = await this.attendances.find({
      where: { employeeId: In(employeeIds), workDate: Between(from, to) },
      order: { workDate: 'ASC' },
    });

    const byEmployee = new Map<number, Attendance[]>();

    for (const row of rows) {
      const key = Number(row.employeeId);
      const list = byEmployee.get(key) ?? [];

      list.push(row);
      byEmployee.set(key, list);
    }

    return byEmployee;
  }

  /**
   * Số người phụ thuộc ĐANG hiệu lực của từng nhân viên.
   *
   * `end_date` được xét: một người phụ thuộc đã hết hiệu lực (con đủ 18 tuổi)
   * vẫn nằm trong bảng để giữ lịch sử, nhưng không còn được giảm trừ.
   */
  async countActiveDependents(
    employeeIds: number[],
    periodEnd: string,
  ): Promise<Map<number, number>> {
    if (employeeIds.length === 0) {
      return new Map();
    }

    const rows: { employeeId: string; total: string }[] = await this.employees
      .createQueryBuilder('employee')
      .select('dependent.employee_id', 'employeeId')
      .addSelect('COUNT(*)', 'total')
      .innerJoin(
        'dependents',
        'dependent',
        'dependent.employee_id = employee.id',
      )
      .where('employee.id IN (:...employeeIds)', { employeeIds })
      .andWhere("dependent.status = 'active'")
      .andWhere('dependent.registration_date <= :periodEnd', { periodEnd })
      .andWhere(
        '(dependent.end_date IS NULL OR dependent.end_date >= :periodEnd)',
        {
          periodEnd,
        },
      )
      .groupBy('dependent.employee_id')
      .getRawMany();

    return new Map(
      rows.map((row) => [Number(row.employeeId), Number(row.total)]),
    );
  }

  /** Tạm ứng ĐÃ DUYỆT của kỳ, gộp theo nhân viên. */
  async sumApprovedAdvances(
    year: number,
    month: number,
  ): Promise<Map<number, number>> {
    const rows = await this.advances.find({
      where: {
        deductYear: year,
        deductMonth: month,
        status: In([
          SalaryAdvanceStatus.APPROVED,
          SalaryAdvanceStatus.DEDUCTED,
        ]),
      },
    });

    const byEmployee = new Map<number, number>();

    for (const row of rows) {
      const key = Number(row.employeeId);

      byEmployee.set(key, (byEmployee.get(key) ?? 0) + Number(row.amount));
    }

    return byEmployee;
  }

  async findSalariesForPeriod(year: number, month: number): Promise<Salary[]> {
    return this.salaries.find({ where: { year, month } });
  }

  markAdvancesDeducted(year: number, month: number): Promise<unknown> {
    return this.advances.update(
      {
        deductYear: year,
        deductMonth: month,
        status: SalaryAdvanceStatus.APPROVED,
      },
      { status: SalaryAdvanceStatus.DEDUCTED },
    );
  }
}
