import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { startOfDay } from 'date-fns';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { PaidAccessLevel } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { UsageScheduler } from './../usage/usage.scheduler';
import { SubscriptionInfoResponseDto } from './dto/response/subscription-info.dto';
import { subscriptionInfoResponseMapper } from './mapper/subscription.mapper';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usageScheduler: UsageScheduler,
  ) {}

  private logger = new Logger(SubscriptionService.name);

  async getSubscriptionInfo(
    userId: string,
  ): Promise<SubscriptionInfoResponseDto> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userAccess: {
          include: { plan: true },
        },
        UserUsage: {
          where: {
            featureKey: FeatureKey.AI_CREDITS,
          },
          orderBy: { cycleStartedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      this.logger.error(`User ${userId} not found.`);
      throw new InternalServerErrorException(
        'user not found, please check the debug logs',
      );
    }

    if (
      !user.userAccess ||
      user.UserUsage.length === 0 ||
      !user.userAccess.plan
    ) {
      this.logger.warn(`User ${userId} does not have an active subscription.`);
      throw new InternalServerErrorException(
        'user or user access or plan or usage not found, please check the debug logs',
      );
    }

    const mostRecentUsage = user.UserUsage[0];
    const planId = user.userAccess.plan.id;
    if (
      planId !== PaidAccessLevel.FREE &&
      (!mostRecentUsage ||
        startOfDay(mostRecentUsage.cycleStartedAt) < startOfDay(new Date()))
    ) {
      this.logger.log(
        `User ${userId} has a stale/missing usage record. Triggering just-in-time reset.`,
      );

      await this.usageScheduler.resetDailyFeatureUsage(
        userId,
        FeatureKey.AI_CREDITS,
        user.userAccess.expiresAt,
      );

      const freshUsage = await this.prismaService.userUsage.findFirst({
        where: {
          userId,
          featureKey: FeatureKey.AI_CREDITS,
        },
        orderBy: { cycleStartedAt: 'desc' },
        take: 1,
      });

      if (!freshUsage) {
        throw new InternalServerErrorException(
          'Failed to retrieve usage record after just-in-time reset.',
        );
      }

      return subscriptionInfoResponseMapper(
        user.userAccess,
        user.userAccess.plan,
        freshUsage,
      );
    }

    if (!mostRecentUsage) {
      throw new InternalServerErrorException(
        'User usage record is missing and could not be provisioned.',
      );
    }

    return subscriptionInfoResponseMapper(
      user.userAccess,
      user.userAccess.plan,
      mostRecentUsage,
    );
  }
}
