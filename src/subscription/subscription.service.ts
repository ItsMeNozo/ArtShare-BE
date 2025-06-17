import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PaidAccessLevel } from '@prisma/client';
import { startOfDay } from 'date-fns';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { PrismaService } from 'src/prisma.service';
import { SubscriptionInfoResponseDto } from './dto/response/subscription-info.dto';
import { subscriptionInfoResponseMapper } from './mapper/subscription.mapper';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prismaService: PrismaService) {}

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
          orderBy: { cycleStartedAt: 'desc' }, // ← newest first
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
      startOfDay(mostRecentUsage.cycleStartedAt) < startOfDay(new Date())
    ) {
      this.logger.warn(
        `User ${userId} with plan ${planId} has no today's usage cycle.`,
      );
      throw new InternalServerErrorException(
        "user has no today's usage cycle, please check the debug logs",
      );
    }

    return subscriptionInfoResponseMapper(
      user.userAccess,
      user.userAccess.plan,
      user.UserUsage[0],
    );
  }
}
