import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyMember } from './entities/family-member.entity';

/**
 * Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module).
 *
 * `family_members` KHÔNG có `deleted_at` (database-schema.md §3.1) — xoá là
 * xoá thật. Bảng gắn CASCADE theo `employee_id` nên không cần dọn thủ công khi
 * nhân viên bị xoá cứng.
 */
@Injectable()
export class FamilyMembersRepository {
  constructor(
    @InjectRepository(FamilyMember)
    private readonly repository: Repository<FamilyMember>,
  ) {}

  /** Danh sách của một nhân viên – không phân trang (api-spec.md §10). */
  findByEmployee(employeeId: number): Promise<FamilyMember[]> {
    return this.repository
      .createQueryBuilder('member')
      .where('member.employeeId = :employeeId', { employeeId })
      .orderBy('member.id', 'ASC')
      .getMany();
  }

  findById(id: number): Promise<FamilyMember | null> {
    return this.repository
      .createQueryBuilder('member')
      .where('member.id = :id', { id })
      .getOne();
  }

  create(data: Partial<FamilyMember>): Promise<FamilyMember> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: Partial<FamilyMember>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete({ id });
  }
}
