import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from 'src/auth/auth.module';
import { CorsService } from '../common/cors.service';
import { NotificationsController } from './notification.controller';
import { NotificationsGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Module({
  imports: [forwardRef(() => AuthModule), EventEmitterModule, ConfigModule],
  controllers: [NotificationsController],
  providers: [NotificationService, NotificationsGateway, CorsService],
  exports: [NotificationService, NotificationsGateway],
})
export class NotificationModule {}
