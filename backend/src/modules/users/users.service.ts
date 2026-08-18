import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
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
}
