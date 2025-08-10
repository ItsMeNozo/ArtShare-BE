import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { addMonths, startOfDay } from 'date-fns';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { PrismaService } from 'src/prisma.service';
import { UsageService } from 'src/usage/usage.service';

@Injectable()
export class AnniversaryResetScheduler {
  private readonly logger = new Logger(AnniversaryResetScheduler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly usageService: UsageService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'yearlySubscriptionMonthlyReset',
  })
  async handleAnniversaryResets() {
    this.logger.log(
      'Running daily check for yearly subscribers requiring a monthly usage reset...',
    );

    const today = new Date();
    const currentDayOfMonth = today.getDate();

    const usersToReset = await this.prismaService.userAccess.findMany({
      where: {
        monthlyResetDay: currentDayOfMonth,
        expiresAt: { gt: today },
      },
    });

    if (usersToReset.length === 0) {
      this.logger.log(
        `No yearly subscribers found for reset on day ${currentDayOfMonth}.`,
      );
      return;
    }

    this.logger.log(
      `Found ${usersToReset.length} user(s) to reset usage for today.`,
    );

    for (const access of usersToReset) {
      try {
        const cycleStart = startOfDay(today);

        let cycleEnd = addMonths(cycleStart, 1);

        if (cycleEnd > access.expiresAt) {
          cycleEnd = access.expiresAt;
        }

        await this.usageService.resetUsageForNewCycle(
          access.userId,
          FeatureKey.AI_CREDITS,
          cycleStart,
          cycleEnd,
        );

        this.logger.log(
          `Successfully reset monthly usage for user ${access.userId}. New cycle ends ${cycleEnd.toISOString()}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to reset monthly usage for user ${access.userId} on their anniversary.`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    this.logger.log('Finished daily anniversary reset check.');
  }
}
