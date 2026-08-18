import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

/**
 * Chỉ chứa TypeORM query, không có if/else nghiệp vụ (CLAUDE.md §Kiến trúc module).
 * Mọi query đều parameterized qua QueryBuilder / FindOptions.
 */
@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  /**
   * Tìm user theo username HOẶC email (email so sánh không phân biệt hoa/thường).
   * `password` là cột `select: false` nên phải addSelect tường minh.
   */
  findByUsernameOrEmailWithPassword(identifier: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.employee', 'employee')
      .where('user.username = :identifier', { identifier })
      .orWhere('LOWER(user.email) = LOWER(:identifier)', { identifier })
      .getOne();
  }

  /** Tìm theo email (không phân biệt hoa/thường) – dùng cho forgot-password. */
  findByEmail(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.employee', 'employee')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  findById(id: number): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.employee', 'employee')
      .where('user.id = :id', { id })
      .getOne();
  }

  findByIdWithPassword(id: number): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.employee', 'employee')
      .where('user.id = :id', { id })
      .getOne();
  }

  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    await this.repository.update({ id: userId }, { password: passwordHash });
  }

  async updateLastLoginAt(userId: number, loggedInAt: Date): Promise<void> {
    await this.repository.update({ id: userId }, { lastLoginAt: loggedInAt });
  }
}
