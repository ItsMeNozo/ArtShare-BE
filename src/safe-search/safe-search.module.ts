import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { SafeSearchController } from './safe-search.controller';
import { SafeSearchService } from './safe-search.service';

@Module({
  imports: [AuthModule],
  providers: [SafeSearchService],
  controllers: [SafeSearchController],
})
export class SafeSearchModule {}
