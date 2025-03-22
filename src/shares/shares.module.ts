import { Module } from '@nestjs/common';
import { SharesService } from './shares.service';
import { SharesController } from './shares.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [SharesService, PrismaService],
  controllers: [SharesController],
})
export class SharesModule {}
