/**
 * Shared cache abstraction for the whole app (lockout counters, password-reset
 * tokens, master-data caching in a later phase...).
 *
 * Why this abstraction exists: the original architecture (docs/architecture.md
 * §7.2, §8) calls for Redis, but the project currently does NOT run Redis (the
 * project owner's decision: no Redis, no Docker at this stage). All business
 * logic depends only on this interface, so adding Redis later just means
 * implementing `RedisCacheService` and swapping the provider in `CacheModule`
 * — no changes needed in AuthService.
 */
export abstract class CacheService {
  abstract get<T>(key: string): Promise<T | undefined>;

  /** @param ttlSeconds Time to live; omit for no expiry. */
  abstract set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  abstract del(key: string): Promise<void>;

  /**
   * Increments the counter by 1 and returns the new value. If the key doesn't
   * exist yet, it is created with value 1 and `ttlSeconds` applied (mirrors
   * Redis `INCR` + `EXPIRE NX`: the TTL is only set on the first call, later
   * increments do NOT extend it).
   */
  abstract incr(key: string, ttlSeconds?: number): Promise<number>;

  /**
   * Seconds remaining before the key expires.
   * `-2` = key does not exist, `-1` = key exists but has no TTL
   * (matches Redis `TTL` conventions).
   */
  abstract ttl(key: string): Promise<number>;

  /** Clears all keys. For tests / maintenance only, NOT for use in business logic. */
  abstract reset(): Promise<void>;
}
