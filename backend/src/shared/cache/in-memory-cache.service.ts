import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CacheService } from './cache.service';

interface CacheEntry {
  value: unknown;
  /** Epoch ms; `undefined` = no expiry. */
  expiresAt?: number;
}

const SWEEP_INTERVAL_MS = 60_000;

/**
 * In-memory cache driver (Map + per-key TTL + periodic sweep).
 *
 * WARNING – LIMITATIONS to revisit before going to production:
 *  1. State lives in the process's RAM → restarting the app LOSES all lockout
 *     counters and pending password-reset tokens.
 *  2. NOT shared across processes → running a PM2 cluster (multiple workers)
 *     means each worker has its own counters, so failed-login counts become
 *     inaccurate and a password-reset token created on worker A can't be read
 *     on worker B.
 *  3. No size-based eviction → only suitable for small, TTL-bound data.
 *
 * To address these: add a `RedisCacheService implements CacheService` and
 * swap the provider in `CacheModule`. No business logic needs to change.
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
    // Don't keep the event loop alive just for this timer.
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
    // Leave expiresAt unchanged: the TTL is only counted from the first incr.
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
