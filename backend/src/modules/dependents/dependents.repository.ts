import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dependent, DependentStatus } from './entities/dependent.entity';

/**
 * Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module).
 *
 * `dependents` KHÔNG có `deleted_at` (database-schema.md §3.2) nên xoá là xoá
 * thật. Bảng gắn CASCADE theo `employee_id`.
 */
@Injectable()
export class DependentsRepository {
  constructor(
    @InjectRepository(Dependent)
    private readonly repository: Repository<Dependent>,
  ) {}

  /** Danh sách của một nhân viên – không phân trang (api-spec.md §11). */
  findByEmployee(employeeId: number): Promise<Dependent[]> {
    return (
      this.repository
        .createQueryBuilder('dependent')
        .where('dependent.employeeId = :employeeId', { employeeId })
        // Người đang được giảm trừ lên đầu, rồi tới ngày đăng ký mới nhất.
        .orderBy('dependent.status', 'ASC')
        .addOrderBy('dependent.registrationDate', 'DESC')
        .addOrderBy('dependent.id', 'ASC')
        .getMany()
    );
  }

  findById(id: number): Promise<Dependent | null> {
    return this.repository
      .createQueryBuilder('dependent')
      .where('dependent.id = :id', { id })
      .getOne();
  }

  /**
   * Người phụ thuộc đang `active` khác đã dùng CCCD/MST này chưa — kể cả ở
   * NHÂN VIÊN KHÁC.
   *
   * Điều 19 Luật Thuế TNCN: mỗi người phụ thuộc chỉ được tính giảm trừ cho MỘT
   * người nộp thuế. Hai vợ chồng cùng làm ở công ty này mà cùng khai một đứa
   * con là lỗi quyết toán thuế, nên phải chặn ở đây chứ không đợi tới kỳ lương.
   */
  findActiveDuplicate(
    field: 'cccdNumber' | 'taxCode',
    value: string,
    excludeId?: number,
  ): Promise<Dependent | null> {
    const query = this.repository
      .createQueryBuilder('dependent')
      .leftJoinAndSelect('dependent.employee', 'employee')
      .where(`dependent.${field} = :value`, { value })
      .andWhere('dependent.status = :status', {
        status: DependentStatus.ACTIVE,
      });

    if (excludeId !== undefined) {
      query.andWhere('dependent.id <> :excludeId', { excludeId });
    }

    return query.getOne();
  }

  create(data: Partial<Dependent>): Promise<Dependent> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: Partial<Dependent>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete({ id });
  }
}
