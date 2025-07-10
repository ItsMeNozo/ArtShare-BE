import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SimpleCacheService } from './simple-cache.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SimpleCacheService],
  exports: [SimpleCacheService],
})
export class CacheModule {}
