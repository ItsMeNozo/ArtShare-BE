import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { PaidAccessLevel } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { UsageService } from 'src/usage/usage.service';
import { SubscriptionInfoResponseDto } from './dto/response/subscription-info.dto';
import { subscriptionInfoResponseMapper } from './mapper/subscription.mapper';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prismaService: PrismaService,

    private readonly usageService: UsageService,
  ) {}

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

    if (!user || !user.userAccess || !user.userAccess.plan) {
      this.logger.warn(`User ${userId} or their access/plan record not found.`);
      throw new NotFoundException(
        'Subscription information not found for user.',
      );
    }

    let mostRecentUsage = user.UserUsage[0] || null;
    const { userAccess } = user;
    const now = new Date();

    if (
      userAccess.plan.id !== PaidAccessLevel.FREE &&
      (!mostRecentUsage || now > mostRecentUsage.cycleEndsAt)
    ) {
      if (now < userAccess.expiresAt) {
        this.logger.log(
          `User ${userId}'s usage record is stale. Triggering just-in-time reset. Last cycle ended: ${mostRecentUsage?.cycleEndsAt.toISOString()}`,
        );

        const cycleStart = mostRecentUsage ? mostRecentUsage.cycleEndsAt : now;
        const cycleEnd = userAccess.expiresAt;

        mostRecentUsage = await this.usageService.resetUsageForNewCycle(
          userId,
          FeatureKey.AI_CREDITS,
          cycleStart,
          cycleEnd,
        );
      } else {
        this.logger.warn(
          `User ${userId} has a stale usage record, but their subscription has also expired at ${userAccess.expiresAt.toISOString()}. No JIT reset performed.`,
        );
      }
    }

    if (!mostRecentUsage) {
      throw new InternalServerErrorException(
        'User usage record is missing and could not be provisioned.',
      );
    }

    return subscriptionInfoResponseMapper(
      userAccess,
      userAccess.plan,
      mostRecentUsage,
    );
  }
}
