import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { subscriptionInfoResponseMapper } from './mapper/subscription.mapper';
import { SubscriptionInfoResponseDto } from './dto/response/subscription-info.dto';
import { endOfDay, startOfDay } from 'date-fns';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';

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
            cycleStartedAt: {
              gte: startOfDay(new Date()),
              lt: endOfDay(new Date()),
            },
          },
          orderBy: { cycleStartedAt: 'desc' }, // ← newest first
          take: 1,
        },
      },
    });

    if (
      !user ||
      !user.userAccess ||
      user.UserUsage.length === 0 ||
      !user.userAccess.plan
    ) {
      this.logger.warn(`User ${userId} does not have an active subscription.`);
      throw new InternalServerErrorException(
        'user or user access or plan or usage not found, please check the debug logs',
      );
    }

    return subscriptionInfoResponseMapper(
      user.userAccess,
      user.userAccess.plan,
      user.UserUsage[0],
    );
  }
}
