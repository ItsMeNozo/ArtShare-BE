import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UsageScheduler } from './usage.scheduler';
import { UsageService } from './usage.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [UsageScheduler, UsageService],
  exports: [UsageService, UsageScheduler],
})
export class UsageModule {}
