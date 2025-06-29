import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notification.controller';
import { NotificationsGateway } from './notification.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CorsService } from '../common/cors.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    EventEmitterModule,
    ConfigModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationService, NotificationsGateway, CorsService],
  exports: [NotificationService, NotificationsGateway],
})
export class NotificationModule {}
