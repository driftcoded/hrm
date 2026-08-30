import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { InMemoryCacheService } from './in-memory-cache.service';

/**
 * Global so every module can inject `CacheService` without re-importing it.
 * Swapping the driver (e.g. to Redis) only requires changing `useClass` here.
 */
@Global()
@Module({
  providers: [{ provide: CacheService, useClass: InMemoryCacheService }],
  exports: [CacheService],
})
export class CacheModule {}
