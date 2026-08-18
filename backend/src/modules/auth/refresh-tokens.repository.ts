import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

export interface CreateRefreshTokenData {
  userId: number;
  /** SHA-256 hex của token thật (token thật chỉ nằm trong cookie). */
  tokenHash: string;
  device: string | null;
  ipAddress: string | null;
  expiresAt: Date;
}

/**
 * Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module).
 * Mọi query parameterized – không nối chuỗi SQL.
 */
@Injectable()
export class RefreshTokensRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repository: Repository<RefreshToken>,
  ) {}

  create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.repository.save(this.repository.create(data));
  }

  findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repository.findOne({ where: { tokenHash } });
  }

  /** Dùng cho logout: session được xác định qua claim `sid` của access token. */
  findById(id: number): Promise<RefreshToken | null> {
    return this.repository.findOne({ where: { id } });
  }

  countActiveByUserId(userId: number, now: Date): Promise<number> {
    return this.repository.count({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(now) },
    });
  }

  /** Session còn hiệu lực, cũ nhất trước – dùng để kick session khi vượt giới hạn. */
  findActiveByUserIdOldestFirst(
    userId: number,
    now: Date,
  ): Promise<RefreshToken[]> {
    return this.repository.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(now) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async revokeById(id: number, revokedAt = new Date()): Promise<void> {
    await this.repository.update({ id, revokedAt: IsNull() }, { revokedAt });
  }

  /** Revoke toàn bộ session của user (logout-all, đổi mật khẩu, phát hiện reuse token). */
  async revokeAllByUserId(
    userId: number,
    revokedAt = new Date(),
  ): Promise<number> {
    const result = await this.repository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt },
    );

    return result.affected ?? 0;
  }
}
