import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';
import { StorageModule } from 'src/storage/storage.module';
import { UserReadService } from './user-read.service';
import { UserAdminController } from './user.admin.controller';
import { UserAdminService } from './user.admin.service';
import { UserController } from './user.controller';
import { UserFollowService } from './user.follow.service';
import { UserService } from './user.service';

@Module({
  imports: [AuthModule, ConfigModule, StorageModule],
  controllers: [UserController, UserAdminController],
  providers: [
    UserService,
    UserAdminService,
    UserFollowService,
    AuthService,
    UserReadService,
  ],
  exports: [UserFollowService, UserService],
})
export class UserModule {}
