import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsageModule } from 'src/usage/usage.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [AuthModule, UsageModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
})
export class SubscriptionModule {}
