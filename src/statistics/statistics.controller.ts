import { Controller, Get, Query } from '@nestjs/common';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  async getStatistics(@Query('days') days?: string) {
    const daysBack = days ? parseInt(days, 10) : undefined;
    return this.statisticsService.getAll(daysBack);
  }
}
