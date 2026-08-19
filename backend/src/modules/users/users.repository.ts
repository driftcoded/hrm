import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../auth/entities/role.entity';
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
    // Dropdown vai trò khi tạo tài khoản + kiểm tra roleId có thật.
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
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

  /**
   * Tìm theo username, KỂ CẢ tài khoản đã xoá mềm.
   *
   * `users.username` là UNIQUE và xoá mềm không gỡ ràng buộc đó, nên nếu chỉ dò
   * trong tài khoản "sống" thì INSERT sẽ nổ ER_DUP_ENTRY (500) thay vì 409.
   */
  findByUsernameWithDeleted(username: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.username = :username', { username })
      .getOne();
  }

  /** Tìm theo email, kể cả tài khoản đã xoá mềm — xem findByUsernameWithDeleted. */
  findByEmailWithDeleted(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .withDeleted()
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  /** `users.employee_id` là UNIQUE: mỗi nhân viên tối đa một tài khoản. */
  findByEmployeeIdWithDeleted(employeeId: number): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.employeeId = :employeeId', { employeeId })
      .getOne();
  }

  findRoleById(id: number): Promise<Role | null> {
    return this.roleRepository
      .createQueryBuilder('role')
      .where('role.id = :id', { id })
      .getOne();
  }

  findActiveRoles(): Promise<Role[]> {
    return this.roleRepository
      .createQueryBuilder('role')
      .where('role.isActive = TRUE')
      .orderBy('role.id', 'ASC')
      .getMany();
  }

  create(data: Partial<User>): Promise<User> {
    return this.repository.save(this.repository.create(data));
  }
}
