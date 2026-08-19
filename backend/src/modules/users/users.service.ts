import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { toIsoString } from '@/common/utils/date.util';
import { CreateUserDto } from './dto/create-user.dto';
import { RoleResponseDto, UserResponseDto } from './dto/user-response.dto';
import { User, UserStatus } from './entities/user.entity';
import { UsersRepository } from './users.repository';

/** Salt rounds bắt buộc = 10 (CLAUDE.md §Bảo mật). */
export const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /** Login cho phép nhập username HOẶC email (xem AuthService.login). */
  findByUsernameOrEmailWithPassword(identifier: string): Promise<User | null> {
    return this.usersRepository.findByUsernameOrEmailWithPassword(
      identifier.trim(),
    );
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email.trim());
  }

  findById(id: number): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  findByIdWithPassword(id: number): Promise<User | null> {
    return this.usersRepository.findByIdWithPassword(id);
  }

  hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
  }

  comparePassword(
    plainPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  async updatePassword(userId: number, plainPassword: string): Promise<void> {
    const passwordHash = await this.hashPassword(plainPassword);
    await this.usersRepository.updatePassword(userId, passwordHash);
  }

  async markLoggedIn(userId: number, loggedInAt = new Date()): Promise<void> {
    await this.usersRepository.updateLastLoginAt(userId, loggedInAt);
  }

  /** `GET /roles` – 5 vai trò seed, dùng đổ dropdown khi tạo tài khoản. */
  async findRoles(): Promise<RoleResponseDto[]> {
    const roles = await this.usersRepository.findActiveRoles();

    return roles.map((role) => ({
      id: Number(role.id),
      name: role.name,
      displayName: role.displayName,
      description: role.description,
    }));
  }

  /**
   * `POST /users` – tạo tài khoản đăng nhập (api-spec.md §13).
   *
   * Ba cột UNIQUE (`username`, `email`, `employee_id`) đều được kiểm tra TRƯỚC
   * khi ghi, kèm `withDeleted()`, để trả 409 có `error.code` rõ ràng thay vì để
   * MySQL ném ER_DUP_ENTRY thành 500.
   */
  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const username = dto.username.trim();
    const email = dto.email.trim().toLowerCase();
    const employeeId = dto.employeeId ?? null;

    const existingUsername =
      await this.usersRepository.findByUsernameWithDeleted(username);
    if (existingUsername) {
      throw new ConflictException({
        code: 'DUPLICATE_USERNAME',
        message: `Username "${username}" already exists (user ${existingUsername.id})`,
      });
    }

    const existingEmail =
      await this.usersRepository.findByEmailWithDeleted(email);
    if (existingEmail) {
      throw new ConflictException({
        code: 'DUPLICATE_EMAIL',
        message: `Email "${email}" already belongs to user ${existingEmail.id}`,
      });
    }

    if (employeeId !== null) {
      const existingEmployee =
        await this.usersRepository.findByEmployeeIdWithDeleted(employeeId);
      if (existingEmployee) {
        throw new ConflictException({
          code: 'EMPLOYEE_ALREADY_HAS_ACCOUNT',
          message: `Employee ${employeeId} is already linked to user ${existingEmployee.id}`,
        });
      }
    }

    const role = await this.usersRepository.findRoleById(dto.roleId);
    if (!role) {
      throw new UnprocessableEntityException({
        code: 'ROLE_NOT_FOUND',
        message: `Cannot find role with id ${dto.roleId}`,
      });
    }

    const created = await this.usersRepository.create({
      username,
      email,
      password: await this.hashPassword(dto.password),
      roleId: dto.roleId,
      employeeId,
      status: dto.status ?? UserStatus.ACTIVE,
    });

    return {
      id: Number(created.id),
      username: created.username,
      email: created.email,
      role: {
        id: Number(role.id),
        name: role.name,
        displayName: role.displayName,
      },
      employeeId:
        created.employeeId === null ? null : Number(created.employeeId),
      status: created.status,
      createdAt: toIsoString(created.createdAt),
    };
  }
}
