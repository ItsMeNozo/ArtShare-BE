import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from 'src/auth/auth.module';
import { UsageModule } from 'src/usage/usage.module';
import { StripeCoreService } from './stripe-core.service';
import { StripeDbService } from './stripe-db.service';
import { StripeWebhookProcessorService } from './stripe-webhook-processor.service';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

@Module({
  imports: [ConfigModule, AuthModule, UsageModule],
  controllers: [StripeController],
  providers: [
    StripeService,
    StripeCoreService,
    StripeDbService,
    StripeWebhookProcessorService,
  ],
  exports: [StripeService],
})
export class StripeModule {}
