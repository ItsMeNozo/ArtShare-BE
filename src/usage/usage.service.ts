import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { Prisma, UserUsage } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { UserAccessWithPlan } from './types/user-access.type';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async handleCreditUsage(
    userId: string,
    featureKey: FeatureKey,
    creditCost: number,
  ): Promise<void> {
    const userAccess = await this.getUserAccessWithPlan(userId);
    const userUsage = await this.getActiveUsageRecord(userId, featureKey);

    if (userAccess.plan.monthlyQuotaCredits === null) {
      this.logger.error(
        `Plan ${userAccess.plan.id} for user ${userId} has no defined monthly quota.`,
      );
      throw new InternalServerErrorException(
        "Monthly quota is not configured for this user's plan.",
      );
    }

    const updated = await this.prismaService.userUsage.updateMany({
      where: {
        id: userUsage.id,

        usedAmount: {
          lte: userAccess.plan.monthlyQuotaCredits - creditCost,
        },
      },
      data: {
        usedAmount: { increment: creditCost },
      },
    });

    if (updated.count === 0) {
      this.logger.warn(
        `User ${userId} has insufficient credits for cost ${creditCost}. Current usage: ${userUsage.usedAmount}, Quota: ${userAccess.plan.monthlyQuotaCredits}`,
      );
      throw new BadRequestException(
        'AI credit limit reached. Please wait for your next billing cycle.',
      );
    }

    this.logger.debug(
      `Successfully deducted ${creditCost} credits for user ${userId}.`,
    );
  }

  async resetUsageForNewCycle(
    userId: string,
    featureKey: FeatureKey,
    cycleStart: Date,
    cycleEnd: Date,
  ): Promise<Prisma.UserUsageGetPayload<object>> {
    this.logger.log(
      `Upserting usage cycle for User ${userId}, Feature ${featureKey}, from ${cycleStart.toISOString()} to ${cycleEnd.toISOString()}`,
    );

    return this.prismaService.userUsage.upsert({
      where: {
        userId_featureKey_cycleStartedAt: {
          userId,
          featureKey,
          cycleStartedAt: cycleStart,
        },
      },

      update: {
        usedAmount: 0,
        cycleEndsAt: cycleEnd,
      },

      create: {
        userId,
        featureKey,
        usedAmount: 0,
        cycleStartedAt: cycleStart,
        cycleEndsAt: cycleEnd,
      },
    });
  }

  private async getActiveUsageRecord(
    userId: string,
    featureKey: FeatureKey,
  ): Promise<UserUsage> {
    const now = new Date();
    const usage = await this.prismaService.userUsage.findFirst({
      where: {
        userId,
        featureKey,

        cycleStartedAt: { lte: now },
        cycleEndsAt: { gte: now },
      },
      orderBy: { cycleStartedAt: 'desc' },
    });

    if (!usage) {
      this.logger.error(
        `No active usage record found for user ${userId} for the current period.`,
      );

      throw new NotFoundException(
        'No active usage cycle found. Please check your subscription status or contact support.',
      );
    }

    return usage;
  }

  private async getUserAccessWithPlan(
    userId: string,
  ): Promise<UserAccessWithPlan> {
    const userAccess = await this.prismaService.userAccess.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!userAccess || !userAccess.plan) {
      this.logger.error(
        `Could not find user access or plan for user ${userId}.`,
      );
      throw new InternalServerErrorException(
        'User subscription information not found.',
      );
    }

    return userAccess;
  }
}
