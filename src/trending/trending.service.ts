import { Injectable, Logger } from '@nestjs/common';
import { StatisticsService } from '../statistics/statistics.service';
import { GeminiService } from './gemini.service';

@Injectable()
export class TrendingService {
  private readonly logger = new Logger(TrendingService.name);
  public static readonly TRENDING_PROMPTS_DB_KEY = 'trending_prompts_v1';

  constructor(
    private statisticsService: StatisticsService,
    private geminiService: GeminiService,
  ) {}

  async handleCron() {
    this.logger.log('CRON: Starting trending prompts calculation...');

    const rawPrompts = await this.statisticsService.getRawTrendingPrompts();

    const thematicPrompts =
      await this.geminiService.generateCanonicalPrompts(rawPrompts);

    if (thematicPrompts.length === 0) {
      this.logger.warn(
        'CRON: Gemini service returned no prompts. Aborting update.',
      );
      return;
    }

    try {
      await this.statisticsService.updateTrendingPrompts(
        TrendingService.TRENDING_PROMPTS_DB_KEY,
        thematicPrompts,
      );
      this.logger.log(
        'CRON: Successfully updated trending prompts in the database.',
      );
    } catch (error) {
      this.logger.error(
        'CRON: Failed to save trending prompts to the database.',
        error,
      );
    }
  }

  async getTrendingPrompts(): Promise<string[]> {
    this.logger.log(
      `Fetching trending prompts for key: ${TrendingService.TRENDING_PROMPTS_DB_KEY}`,
    );
    const storedPrompts = await this.statisticsService.getStoredTrendingPrompts(
      TrendingService.TRENDING_PROMPTS_DB_KEY,
    );
    // const prompts = await this.statisticsService.getRawTrendingPrompts();
    // this.logger.log(`raw prompts: ${prompts}`);

    return storedPrompts || [];
  }
}
