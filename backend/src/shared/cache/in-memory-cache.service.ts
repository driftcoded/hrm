import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CacheService } from './cache.service';

interface CacheEntry {
  value: unknown;
  /** epoch ms; `undefined` = không hết hạn. */
  expiresAt?: number;
}

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Driver cache in-memory (Map + TTL cho từng key + sweep định kỳ).
 *
 * ⚠️ GIỚI HẠN – PHẢI xem lại trước khi lên production:
 *  1. State nằm trong RAM của process → restart app là MẤT toàn bộ counter
 *     lockout và token reset password đang chờ.
 *  2. KHÔNG chia sẻ giữa nhiều process → chạy PM2 cluster (nhiều worker) thì
 *     mỗi worker có counter riêng, đếm login sai sẽ không chính xác và token
 *     reset password tạo ở worker A không đọc được ở worker B.
 *  3. Không có eviction theo dung lượng → chỉ dùng cho dữ liệu nhỏ, có TTL.
 *
 * Khi cần khắc phục: thêm `RedisCacheService implements CacheService` và đổi
 * provider trong `CacheModule`. Business logic không phải sửa dòng nào.
 */
@Injectable()
export class InMemoryCacheService
  extends CacheService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(InMemoryCacheService.name);
  private readonly store = new Map<string, CacheEntry>();
  private sweepTimer?: NodeJS.Timeout;

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Không giữ event loop sống chỉ vì timer này.
    this.sweepTimer.unref();
    this.logger.log(
      'Cache driver: in-memory (state mất khi restart, không dùng được với PM2 cluster)',
    );
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
    this.store.clear();
  }

  get<T>(key: string): Promise<T | undefined> {
    const entry = this.read(key);
    return Promise.resolve(entry ? (entry.value as T) : undefined);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt:
        ttlSeconds === undefined ? undefined : Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  incr(key: string, ttlSeconds?: number): Promise<number> {
    const entry = this.read(key);

    if (!entry) {
      this.store.set(key, {
        value: 1,
        expiresAt:
          ttlSeconds === undefined ? undefined : Date.now() + ttlSeconds * 1000,
      });
      return Promise.resolve(1);
    }

    const current = typeof entry.value === 'number' ? entry.value : 0;
    const next = current + 1;
    // Giữ nguyên expiresAt: TTL chỉ tính từ lần incr đầu tiên.
    entry.value = next;
    return Promise.resolve(next);
  }

  ttl(key: string): Promise<number> {
    const entry = this.read(key);
    if (!entry) {
      return Promise.resolve(-2);
    }
    if (entry.expiresAt === undefined) {
      return Promise.resolve(-1);
    }
    return Promise.resolve(
      Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)),
    );
  }

  reset(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }

  private read(key: string): CacheEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}
