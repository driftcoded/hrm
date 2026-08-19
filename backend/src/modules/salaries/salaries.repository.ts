import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalarySortKey } from './dto/filter-salary.dto';
import { Salary, SalaryStatus } from './entities/salary.entity';

/** Map `sort` (whitelist ở FilterSalaryDto) → cột SQL an toàn. */
const SORT_COLUMNS: Record<SalarySortKey, string> = {
  netSalary: 'salary.netSalary',
  grossSalary: 'salary.grossSalary',
  employeeCode: 'employee.employeeCode',
};

export interface FindSalariesOptions {
  skip: number;
  take: number;
  sort: SalarySortKey;
  order: 'ASC' | 'DESC';
  year: number;
  month?: number;
  employeeId?: number;
  departmentId?: number;
  status?: SalaryStatus;
}

/** Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module). */
@Injectable()
export class SalariesRepository {
  constructor(
    @InjectRepository(Salary)
    private readonly repository: Repository<Salary>,
  ) {}

  findPaginated(options: FindSalariesOptions): Promise<[Salary[], number]> {
    const query = this.repository
      .createQueryBuilder('salary')
      .innerJoinAndSelect('salary.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .where('salary.year = :year', { year: options.year })
      .orderBy(SORT_COLUMNS[options.sort], options.order)
      .addOrderBy('salary.id', 'ASC')
      .skip(options.skip)
      .take(options.take);

    if (options.month !== undefined) {
      query.andWhere('salary.month = :month', { month: options.month });
    }

    if (options.employeeId !== undefined) {
      query.andWhere('salary.employeeId = :employeeId', {
        employeeId: options.employeeId,
      });
    }

    if (options.departmentId !== undefined) {
      query.andWhere('employee.departmentId = :departmentId', {
        departmentId: options.departmentId,
      });
    }

    if (options.status !== undefined) {
      query.andWhere('salary.status = :status', { status: options.status });
    }

    return query.getManyAndCount();
  }

  findById(id: number): Promise<Salary | null> {
    return this.repository.findOne({
      where: { id },
      relations: { employee: { department: true, position: true } },
    });
  }

  save(salary: Salary): Promise<Salary> {
    return this.repository.save(salary);
  }

  /**
   * Tổng hợp một kỳ lương — dùng cho thẻ số liệu trên đầu trang.
   *
   * Gộp ở DB chứ không kéo hết dòng về rồi cộng bằng JavaScript: một kỳ của
   * công ty vài trăm người thì đó là vài trăm dòng chỉ để lấy ba con số.
   */
  async summarisePeriod(
    year: number,
    month: number,
  ): Promise<{
    headcount: number;
    totalGross: number;
    totalNet: number;
    totalInsurance: number;
    totalTax: number;
    byStatus: Record<string, number>;
  }> {
    const totals:
      | {
          headcount: string;
          totalGross: string | null;
          totalNet: string | null;
          totalInsurance: string | null;
          totalTax: string | null;
        }
      | undefined = await this.repository
      .createQueryBuilder('salary')
      .select('COUNT(*)', 'headcount')
      .addSelect('SUM(salary.grossSalary)', 'totalGross')
      .addSelect('SUM(salary.netSalary)', 'totalNet')
      .addSelect('SUM(salary.totalInsurance)', 'totalInsurance')
      .addSelect('SUM(salary.personalIncomeTax)', 'totalTax')
      .where('salary.year = :year AND salary.month = :month', { year, month })
      .getRawOne();

    const statusRows: { status: string; total: string }[] =
      await this.repository
        .createQueryBuilder('salary')
        .select('salary.status', 'status')
        .addSelect('COUNT(*)', 'total')
        .where('salary.year = :year AND salary.month = :month', { year, month })
        .groupBy('salary.status')
        .getRawMany();

    return {
      headcount: Number(totals?.headcount ?? 0),
      totalGross: Number(totals?.totalGross ?? 0),
      totalNet: Number(totals?.totalNet ?? 0),
      totalInsurance: Number(totals?.totalInsurance ?? 0),
      totalTax: Number(totals?.totalTax ?? 0),
      byStatus: Object.fromEntries(
        statusRows.map((row) => [row.status, Number(row.total)]),
      ),
    };
  }

  /** Các kỳ lương ĐÃ CÓ dữ liệu — để giao diện biết chọn tháng nào. */
  async findPeriods(): Promise<{ year: number; month: number }[]> {
    const rows: { year: string; month: string }[] = await this.repository
      .createQueryBuilder('salary')
      .select('salary.year', 'year')
      .addSelect('salary.month', 'month')
      .groupBy('salary.year')
      .addGroupBy('salary.month')
      .orderBy('salary.year', 'DESC')
      .addOrderBy('salary.month', 'DESC')
      .getRawMany();

    return rows.map((row) => ({
      year: Number(row.year),
      month: Number(row.month),
    }));
  }
}
