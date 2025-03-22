import { Module } from '@nestjs/common';
import { LikesService } from './likes.service';
import { LikesController } from './likes.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [LikesService, PrismaService],
  controllers: [LikesController],
})
export class LikesModule {}
