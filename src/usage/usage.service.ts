import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { startOfDay } from 'date-fns';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { TryCatch } from 'src/common/try-catch.decorator';
import { PaidAccessLevel, Prisma, UserUsage } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { UserAccessWithPlan } from './types/user-access.type';

@Injectable()
export class UsageService {
  constructor(private readonly prismaService: PrismaService) {}

  private logger = new Logger(UsageService.name);

  @TryCatch()
  async handleCreditUsage(
    userId: string,
    featureKey: FeatureKey,
    creditCost: number,
  ): Promise<void> {
    const userAccess = await this.getUserAccess(userId);
    const userUsage = await this.getUserUsage(userId, featureKey, userAccess);

    const updated = await this.prismaService.userUsage.updateMany({
      where: {
        id: userUsage.id,
        // ensure there’s enough headroom
        usedAmount: {
          lte: userAccess.plan.dailyQuotaCredits - creditCost,
        },
      },
      data: {
        usedAmount: { increment: creditCost },
      },
    });
    if (updated.count === 0) {
      throw new BadRequestException(
        'Daily AI credit limit exceeded. Please try again tomorrow.',
      );
    }
  }

  private async getUserUsage(
    userId: string,
    featureKey: FeatureKey,
    userAccess: UserAccessWithPlan,
  ): Promise<UserUsage> {
    const todayStart = startOfDay(new Date());

    // build a `where` filter that only includes `cycleStartedAt` for paid plans
    const baseWhere: Prisma.UserUsageWhereInput = {
      userId,
      featureKey,
      ...(userAccess.plan.id !== PaidAccessLevel.FREE
        ? { cycleStartedAt: { gte: todayStart } }
        : {}),
    };

    const usage = await this.prismaService.userUsage.findFirst({
      where: baseWhere,
      orderBy: { cycleStartedAt: 'desc' },
    });

    if (!usage) {
      throw new BadRequestException(
        userAccess.plan.id === PaidAccessLevel.FREE
          ? `No usage record found for free plan.`
          : `No usage record found for today’s cycle.`,
      );
    }

    return usage;
  }

  private async getUserAccess(userId: string): Promise<UserAccessWithPlan> {
    const userAccess = await this.prismaService.userAccess.findUnique({
      where: {
        userId: userId,
      },
      include: {
        plan: true,
      },
    });
    if (!userAccess) {
      throw new InternalServerErrorException('User access not found');
    }

    return userAccess;
  }
}
