import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsageScheduler } from './usage.scheduler';
import { UsageService } from './usage.service';

@Module({
  imports: [ConfigModule],
  providers: [UsageScheduler, UsageService],
  exports: [UsageService, UsageScheduler],
})
export class UsageModule {}
