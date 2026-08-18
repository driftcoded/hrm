/**
 * Abstraction cache dùng chung cho toàn app (lockout counter, reset-password
 * token, cache master data ở phase sau...).
 *
 * Lý do có abstraction này: kiến trúc gốc (docs/architecture.md §7.2, §8) dùng
 * Redis, nhưng dự án hiện KHÔNG chạy Redis (quyết định của chủ dự án: không
 * Redis, không Docker ở giai đoạn này). Toàn bộ business logic chỉ phụ thuộc
 * vào interface này, nên khi cần chỉ việc thêm `RedisCacheService` và đổi
 * provider trong `CacheModule` — không phải sửa AuthService.
 */
export abstract class CacheService {
  abstract get<T>(key: string): Promise<T | undefined>;

  /** @param ttlSeconds thời gian sống; bỏ trống = không hết hạn. */
  abstract set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  abstract del(key: string): Promise<void>;

  /**
   * Tăng counter lên 1 và trả về giá trị mới. Nếu key chưa tồn tại thì tạo mới
   * với giá trị 1 và áp dụng `ttlSeconds` (giống `INCR` + `EXPIRE NX` của Redis:
   * TTL chỉ set ở lần đầu, các lần incr sau KHÔNG gia hạn).
   */
  abstract incr(key: string, ttlSeconds?: number): Promise<number>;

  /**
   * Số giây còn lại trước khi key hết hạn.
   * `-2` = key không tồn tại, `-1` = key tồn tại nhưng không có TTL
   * (giữ đúng quy ước của Redis `TTL`).
   */
  abstract ttl(key: string): Promise<number>;

  /** Xoá toàn bộ key. Dùng cho test / maintenance, KHÔNG dùng trong business logic. */
  abstract reset(): Promise<void>;
}
