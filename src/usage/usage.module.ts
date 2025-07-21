import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UsageScheduler } from './usage.scheduler';
import { UsageService } from './usage.service';

import { UsageController } from './usage.controller';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  controllers: [UsageController],
  providers: [UsageScheduler, UsageService],
  exports: [UsageService, UsageScheduler],
})
export class UsageModule {}
