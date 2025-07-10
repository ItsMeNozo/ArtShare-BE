import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { StatisticsModule } from 'src/statistics/statistics.module';
import { ChatService } from './chat.service';
import { GeminiService } from './gemini.service';
import { ChatRepository } from './repositories/chat.repository';
import { TrendingController } from './trending.controller';
import { TrendingService } from './trending.service';

@Module({
  imports: [AuthModule, forwardRef(() => StatisticsModule)],
  controllers: [TrendingController],
  providers: [TrendingService, GeminiService, ChatService, ChatRepository],
  exports: [TrendingService, GeminiService, ChatService, ChatRepository],
})
export class TrendingModule {}
