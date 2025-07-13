import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { endOfDay, startOfDay } from 'date-fns';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { TryCatch } from 'src/common/try-catch.decorator';
import { PaidAccessLevel } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class UsageScheduler {
  private readonly logger = new Logger(UsageScheduler.name);
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.error(
        'CRITICAL: Stripe Secret Key not configured for UsageScheduler.',
      );
    } else {
      this.stripe = new Stripe(secretKey, { apiVersion: '2025-04-30.basil' });
      this.logger.log('UsageScheduler initialized Stripe client.');
    }
  }

  /**
  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'monthlyQuotaReset',
    timeZone: 'UTC',
  })
  async handleMonthlyQuotaReset() {
    this.logger.log('Running scheduled task: handleMonthlyQuotaReset...');
    const now = new Date();

  //   const activeAccessRecords = await this.prisma.userAccess.findMany({
  //     where: {
  //       expiresAt: { gt: now },
  //       plan: {
  //         OR: [
  //           { monthlyQuotaCredits: { not: null } },
  //           { storageQuotaMB: { not: null } },
  //         ],
  //       },
  //     },
  //     include: {
  //       plan: true,
  //       user: { select: { id: true } },
  //     },
  //   });

  //   this.logger.log(
  //     `Found ${activeAccessRecords.length} active subscriptions to check for monthly quota resets.`,
  //   );

  //   for (const access of activeAccessRecords) {
  //     const userId = access.userId;
  //     const plan = access.plan;

  //     if (plan.monthlyQuotaCredits !== null) {
  //       await this.resetFeatureUsageIfNeeded(
  //         userId,
  //         'ai_credits',
  //         access.stripeSubscriptionId,
  //         now,
  //         access.expiresAt,
  //       );
  //     }

  //     if (plan.storageQuotaMB !== null) {
  //       await this.resetFeatureUsageIfNeeded(
  //         userId,
  //         'storage_mb',
  //         access.stripeSubscriptionId,
  //         now,
  //         access.expiresAt,
  //       );
  //     }
  //   }
  //   this.logger.log('Finished scheduled task: handleMonthlyQuotaReset.');
  // }

  private async resetFeatureUsageIfNeeded(
    userId: string,
    featureKey: string,
    stripeSubscriptionId: string,
    now: Date,
    subscriptionOverallEndDate: Date,
  ): Promise<void> {
    this.logger.debug(
      `Checking reset for user ${userId}, feature ${featureKey}, sub ${stripeSubscriptionId}`,
    );

    let subscriptionStartDate: Date;
    try {
      if (!this.stripe) {
        throw new Error('Stripe client not initialized.');
      }
      const stripeSub =
        await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
      if (typeof stripeSub.start_date !== 'number') {
        throw new Error('Could not determine subscription start_date.');
      }
      subscriptionStartDate = new Date(stripeSub.start_date * 1000);
      this.logger.debug(
        `Using Stripe Sub ${stripeSubscriptionId} start_date as anchor: ${subscriptionStartDate.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to retrieve Stripe Sub ${stripeSubscriptionId} or get start_date for user ${userId}, feature ${featureKey}:`,
        error,
      );
      return;
    }

    let currentCycleStartDate = new Date(subscriptionStartDate.getTime());
    currentCycleStartDate.setUTCHours(0, 0, 0, 0);

    while (true) {
      const nextCycleStartDate = new Date(currentCycleStartDate.getTime());
      nextCycleStartDate.setUTCMonth(nextCycleStartDate.getUTCMonth() + 1);
      if (nextCycleStartDate > now) {
        break;
      }
      currentCycleStartDate = nextCycleStartDate;
    }
    this.logger.debug(
      `Calculated current monthly cycle start date: ${currentCycleStartDate.toISOString()}`,
    );

    let currentCycleEndDate = new Date(currentCycleStartDate.getTime());
    currentCycleEndDate.setUTCMonth(currentCycleEndDate.getUTCMonth() + 1);
    currentCycleEndDate.setUTCDate(currentCycleEndDate.getUTCDate() - 1);
    currentCycleEndDate.setUTCHours(23, 59, 59, 999);

    if (currentCycleEndDate > subscriptionOverallEndDate) {
      currentCycleEndDate = subscriptionOverallEndDate;
    }
    this.logger.debug(
      `Calculated current monthly cycle end date: ${currentCycleEndDate.toISOString()}`,
    );

    this.logger.log(
      `User ${userId}, feature ${featureKey}: Ensuring usage record exists and is reset for cycle starting ${currentCycleStartDate.toISOString()}`,
    );
    try {
      await this.prisma.userUsage.upsert({
        where: {
          userId_featureKey_cycleStartedAt: {
            userId,
            featureKey,
            cycleStartedAt: currentCycleStartDate,
          },
        },

        update: { cycleEndsAt: currentCycleEndDate },

        create: {
          userId,
          featureKey,
          usedAmount: 0,
          cycleStartedAt: currentCycleStartDate,
          cycleEndsAt: currentCycleEndDate,
        },
      });
      this.logger.log(
        `Successfully ensured usage record exists/is reset for user ${userId}, feature ${featureKey}, cycle start ${currentCycleStartDate.toISOString()}.`,
      );
    } catch (dbError) {
      this.logger.error(
        `DB error upserting usage record for user ${userId}, feature ${featureKey}:`,
        dbError,
      );
    }
  }
  */

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'dailyQuotaReset',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  @TryCatch()
  async handleDailyQuotaReset(): Promise<void> {
    this.logger.log('Running scheduled task: handleDailyQuotaReset…');

    const now = new Date();

    // Only users on the Artist Pro plan get a daily reset
    const dailyAccesses = await this.prisma.userAccess.findMany({
      where: {
        expiresAt: { gt: now },
        plan: { id: PaidAccessLevel.ARTIST_PRO },
      },
    });

    this.logger.log(
      `Found ${dailyAccesses.length} Artist Pro subscriptions to reset.`,
    );

    for (const access of dailyAccesses) {
      await this.resetDailyFeatureUsage(
        access.userId,
        FeatureKey.AI_CREDITS,
        access.expiresAt,
      );
    }

    this.logger.log('Finished scheduled task: handleDailyQuotaReset.');
  }

  /**
   * Zeroes out (or creates) today’s usage record so that
   * availableCredits = dailyQuotaCredits - usedAmount = 100 - 0 = 100.
   */
  async resetDailyFeatureUsage(
    userId: string,
    featureKey: FeatureKey,
    subscriptionEnd: Date,
  ): Promise<void> {
    const startOfToday = startOfDay(new Date());

    const endOfToday = endOfDay(new Date());
    const effectiveEnd =
      endOfToday > subscriptionEnd ? subscriptionEnd : endOfToday;

    try {
      // 1. Reset any existing “today” usage
      const { count } = await this.prisma.userUsage.updateMany({
        where: {
          userId,
          featureKey,
          cycleStartedAt: {
            gte: startOfToday,
            lt: endOfToday,
          },
        },
        data: {
          usedAmount: 0,
          cycleEndsAt: effectiveEnd,
        },
      });

      // 2. If none was updated, create a fresh row
      if (count === 0) {
        await this.prisma.userUsage.create({
          data: {
            userId,
            featureKey,
            usedAmount: 0,
            cycleStartedAt: startOfToday,
            cycleEndsAt: effectiveEnd,
          },
        });
      }

      this.logger.debug(
        `Daily credits reset for user ${userId} – ` +
          `window ${startOfToday} → ${effectiveEnd.toISOString()}`,
      );
    } catch (err) {
      this.logger.error(`DB error during daily reset for user ${userId}:`, err);
    }
  }
}
