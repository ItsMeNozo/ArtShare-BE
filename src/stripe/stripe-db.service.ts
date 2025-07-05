import { Injectable, Logger } from '@nestjs/common';
import { PaidAccessLevel, Plan, User, UserAccess } from 'src/generated';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class StripeDbService {
  private logger = new Logger(StripeDbService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findUserByStripeData(
    stripeCustomerId?: string | null,
    internalUserId?: string | null,
  ): Promise<User | null> {
    if (stripeCustomerId) {
      const user = await this.prisma.user.findUnique({
        where: { stripeCustomerId: stripeCustomerId },
      });
      if (user) return user;
    }
    if (internalUserId) {
      if (stripeCustomerId) {
        this.logger.warn(
          `Could not find user by stripeCustomerId ${stripeCustomerId}, attempting lookup by internal UserRef: ${internalUserId}`,
        );
      }
      const user = await this.prisma.user.findUnique({
        where: { id: internalUserId },
      });
      if (user) return user;
    }

    return null;
  }

  async updateUserStripeCustomerId(
    userId: string,
    stripeCustomerId: string,
  ): Promise<User> {
    this.logger.warn(
      `Updating stripeCustomerId for user ${userId} to ${stripeCustomerId}`,
    );
    return this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: stripeCustomerId },
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findPlanByStripeProductId(
    stripeProductId: string,
  ): Promise<Plan | null> {
    const plan = await this.prisma.plan.findUnique({
      where: { stripeProductId },
    });
    if (!plan) {
      this.logger.error(
        `Config error: Plan not found for product ${stripeProductId}.`,
      );
    }
    return plan;
  }

  async findUserAccess(userId: string): Promise<UserAccess | null> {
    return this.prisma.userAccess.findFirst({
      where: {
        userId,
        planId: {
          not: PaidAccessLevel.FREE,
        },
      },
    });
  }

  async findUserAccessBySubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<UserAccess | null> {
    return this.prisma.userAccess.findUnique({
      where: { stripeSubscriptionId },
    });
  }

  async upsertUserAccess(data: {
    userId: string;
    planId: string;
    expiresAt: Date;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    stripeCustomerId: string | null;
    cancelAtPeriodEnd: boolean;
  }): Promise<UserAccess> {
    this.logger.log(
      `Upserting UserAccess for ${data.userId}. Plan: ${data.planId}, Expires: ${data.expiresAt?.toISOString()}, CancelAtEnd: ${data.cancelAtPeriodEnd}`,
    );
    return this.prisma.userAccess.upsert({
      where: { userId: data.userId },
      update: {
        planId: data.planId as PaidAccessLevel,
        expiresAt: data.expiresAt,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripePriceId: data.stripePriceId,
        stripeCustomerId: data.stripeCustomerId,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      },
      create: {
        userId: data.userId,
        planId: data.planId as PaidAccessLevel,
        expiresAt: data.expiresAt,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripePriceId: data.stripePriceId,
        stripeCustomerId: data.stripeCustomerId,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      },
    });
  }
}
