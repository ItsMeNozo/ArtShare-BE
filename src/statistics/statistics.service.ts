// src/statistics/statistics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

export interface StatCount {
  key: string;
  count: number;
}

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Add this helper method to build date filter
  private getDateFilter(daysBack?: number): string {
    if (!daysBack) return ''; // No filter = all time
    return `AND created_at >= CURRENT_DATE - INTERVAL '${daysBack} days'`;
  }

  // Update existing method with optional parameter
  private async rawStats(
    column: string,
    table = 'art_generation',
    alias = 'key',
    daysBack?: number,
  ): Promise<StatCount[]> {
    const dateFilter = this.getDateFilter(daysBack);

    type Row = { [key: string]: string | bigint };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        ${Prisma.raw(column)} AS ${Prisma.raw(alias)},
        COUNT(*)              AS count
      FROM ${Prisma.raw(table)}
      WHERE ${Prisma.raw(column)} IS NOT NULL ${Prisma.raw(dateFilter)}
      GROUP BY ${Prisma.raw(column)}
      ORDER BY count DESC;
    `;

    return rows.map((r) => ({
      key: r[alias] as unknown as string,
      count: Number(r.count),
    }));
  }

  // Update each method to accept daysBack parameter
  async getAspectRatioStats(daysBack?: number): Promise<StatCount[]> {
    return this.rawStats('aspect_ratio', 'art_generation', 'key', daysBack);
  }

  async getLightingStats(daysBack?: number): Promise<StatCount[]> {
    return this.rawStats('lighting', 'art_generation', 'key', daysBack);
  }

  async getStyles(daysBack?: number): Promise<StatCount[]> {
    return this.rawStats('style', 'art_generation', 'key', daysBack);
  }

  async getPostsByAI(daysBack?: number): Promise<StatCount[]> {
    const dateFilter = this.getDateFilter(daysBack);

    const rows: Array<{ count: bigint }> = await this.prisma.$queryRaw`
      SELECT COUNT(id) as count
      FROM post
      WHERE ai_created = true ${Prisma.raw(dateFilter)}
    `;
    return [{ key: 'posts_by_ai', count: Number(rows[0]?.count ?? 0) }];
  }

  async getTotalAiImages(daysBack?: number): Promise<StatCount[]> {
    const dateFilter = daysBack
      ? `WHERE created_at >= CURRENT_DATE - INTERVAL '${daysBack} days'`
      : '';

    const rows: Array<{ count: bigint }> = await this.prisma.$queryRaw`
      SELECT SUM(number_of_images_generated) as count
      FROM art_generation
      ${Prisma.raw(dateFilter)}
    `;
    return [{ key: 'ai_images', count: Number(rows[0]?.count ?? 0) }];
  }

  async getTop5PostsByAI(daysBack?: number): Promise<any> {
    const dateFilter = this.getDateFilter(daysBack);

    const rows: Array<{ count: bigint }> = await this.prisma.$queryRaw`
      SELECT *
      FROM post
      WHERE ai_created = true ${Prisma.raw(dateFilter)}
      ORDER BY like_count DESC
      LIMIT 5
    `;
    return rows;
  }

  async getTotalTokenUsage(daysBack?: number): Promise<StatCount[]> {
    const dateFilter = daysBack
      ? `WHERE "createdAt" >= CURRENT_DATE - INTERVAL '${daysBack} days'`
      : '';

    const rows: Array<{ count: bigint }> = await this.prisma.$queryRaw`
      SELECT SUM(used_amount) as count
      FROM user_usage
      ${Prisma.raw(dateFilter)}
    `;
    return [{ key: 'token_usage', count: Number(rows[0]?.count ?? 0) }];
  }

  async getAll(daysBack?: number): Promise<{
    timeRange: { days: number; from: string; to: string };
    aspectRatios: StatCount[];
    styles: StatCount[];
    posts_by_ai: StatCount[];
    total_ai_images: StatCount[];
    top_posts_by_ai: any;
    trending_prompts: any[];
    token_usage: StatCount[];
  }> {
    const [
      aspectRatios,
      styles,
      posts_by_ai,
      total_ai_images,
      top_posts_by_ai,
      token_usage,
    ] = await Promise.all([
      this.getAspectRatioStats(daysBack),
      this.getStyles(daysBack),
      this.getPostsByAI(daysBack),
      this.getTotalAiImages(daysBack),
      this.getTop5PostsByAI(daysBack),
      this.getTotalTokenUsage(daysBack),
    ]);

    const storedPrompts = await this.getStoredTrendingPrompts(
      daysBack ? `trending_prompts_${daysBack}d` : 'trending_prompts_v1',
    );

    const to = new Date();
    const from = daysBack
      ? new Date(to.getTime() - daysBack * 24 * 60 * 60 * 1000)
      : new Date(0); // Beginning of time

    return {
      timeRange: {
        days: daysBack || 0,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      aspectRatios,
      styles,
      posts_by_ai,
      total_ai_images,
      top_posts_by_ai,
      trending_prompts: storedPrompts ?? [],
      token_usage,
    };
  }

  async getRawTrendingPrompts(daysBack: number = 7): Promise<string[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const recentArtGenerations = await this.prisma.artGeneration.findMany({
      where: {
        created_at: {
          gte: startDate,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: Math.min(daysBack * 3, 100), // Scale with days
    });

    return recentArtGenerations.map((item) => item.user_prompt);
  }

  async updateTrendingPrompts(
    key: string,
    promptsToUpdate: string[],
  ): Promise<void> {
    this.logger.log(`Updating trending prompts in DB for key: ${key}`);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.trendingPrompt.deleteMany({
          where: { prompt_key: key },
        });

        await tx.trendingPrompt.create({
          data: {
            prompt_key: key,
            prompts: promptsToUpdate,
          },
        });
      });
      this.logger.log(`Successfully updated prompts for key: ${key}`);
    } catch (error) {
      this.logger.error(
        `Failed to update trending prompts for key: ${key}`,
        error,
      );
      throw error;
    }
  }

  async getStoredTrendingPrompts(key: string): Promise<string[] | null> {
    const result = await this.prisma.trendingPrompt.findUnique({
      where: { prompt_key: key },
    });

    return result ? result.prompts : null;
  }
}