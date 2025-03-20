import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [],
  controllers: [UserController],
  providers: [UserService, PrismaService], // Cung cấp UserService và PrismaService
})
export class UserModule {}
