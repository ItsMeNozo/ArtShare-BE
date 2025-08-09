import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsageService } from './usage.service';

@Module({
  imports: [ConfigModule],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
