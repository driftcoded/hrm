import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { InMemoryCacheService } from './in-memory-cache.service';

/**
 * Global để mọi module inject `CacheService` mà không phải import lại.
 * Đổi driver (ví dụ sang Redis) chỉ cần sửa `useClass` ở đây.
 */
@Global()
@Module({
  providers: [{ provide: CacheService, useClass: InMemoryCacheService }],
  exports: [CacheService],
})
export class CacheModule {}
