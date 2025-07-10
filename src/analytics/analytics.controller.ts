import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  OverallPostStatsDto,
  OverallUserStatsDto,
  PlatformWideStatsDto,
  PopularCategoriesDto,
  PostsByCategoryDto,
  TimeSeriesDataDto,
} from './dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overall-user-stats')
  @ApiOperation({ summary: 'Get overall user statistics' })
  @ApiResponse({
    status: 200,
    description: 'Overall user statistics.',
    type: OverallUserStatsDto,
  })
  async getOverallUserStats(): Promise<OverallUserStatsDto> {
    return this.analyticsService.getOverallUserStats();
  }

  @Get('overall-post-stats')
  @ApiOperation({ summary: 'Get overall post statistics' })
  @ApiResponse({
    status: 200,
    description: 'Overall post statistics.',
    type: OverallPostStatsDto,
  })
  async getOverallPostStats(): Promise<OverallPostStatsDto> {
    return this.analyticsService.getOverallPostStats();
  }

  @Get('posts-by-category')
  @ApiOperation({ summary: 'Get count of posts for each category' })
  @ApiResponse({
    status: 200,
    description: 'Post counts per category.',
    type: PostsByCategoryDto,
  })
  async getPostsByCategory(): Promise<PostsByCategoryDto> {
    return this.analyticsService.getPostsByCategory();
  }

  @Get('popular-categories')
  @ApiOperation({
    summary: 'Get popular categories based on post count or engagement',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of categories to return (default: 5)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['postCount', 'engagement'],
    description: 'Sort by post count or engagement (default: postCount)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of popular categories.',
    type: PopularCategoriesDto,
  })
  async getPopularCategories(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Query('sortBy', new DefaultValuePipe('postCount'))
    sortBy: 'postCount' | 'engagement',
  ): Promise<PopularCategoriesDto> {
    return this.analyticsService.getPopularCategories(limit, sortBy);
  }

  @Get('platform-wide-stats')
  @ApiOperation({
    summary:
      'Get comprehensive platform-wide statistics (funnel, correlations, time-to-action)',
  })
  @ApiResponse({
    status: 200,
    description: 'Comprehensive platform-wide statistics.',
    type: PlatformWideStatsDto,
  })
  async getPlatformWideStats(): Promise<PlatformWideStatsDto> {
    return this.analyticsService.getPlatformWideStats();
  }

  @Get('users-over-time')
  @ApiOperation({
    summary: 'Get cumulative user count over time (daily for N days)',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of past days to include (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Time series data for user counts.',
    type: TimeSeriesDataDto,
  })
  async getUsersOverTime(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ): Promise<TimeSeriesDataDto> {
    return this.analyticsService.getUsersOverTime(days);
  }

  @Get('posts-over-time')
  @ApiOperation({
    summary: 'Get cumulative post count over time (daily for N days)',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of past days to include (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Time series data for post counts.',
    type: TimeSeriesDataDto,
  })
  async getPostsOverTime(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ): Promise<TimeSeriesDataDto> {
    return this.analyticsService.getPostsOverTime(days);
  }
}
