import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [AuthModule],
  providers: [SharesService],
  controllers: [SharesController],
})
export class SharesModule {}
