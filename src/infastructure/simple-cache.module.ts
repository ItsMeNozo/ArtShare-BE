import { Global, Module } from '@nestjs/common';
import { SimpleCacheService } from './simple-cache.service';

@Global()
@Module({
  providers: [SimpleCacheService],
  exports: [SimpleCacheService],
})
export class CacheModule {}
