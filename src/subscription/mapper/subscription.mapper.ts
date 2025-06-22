import { Plan, UserAccess, UserUsage } from 'src/generated';
import {
  SubscriptionInfoResponseDto,
  SubscriptionPlan,
} from '../dto/response/subscription-info.dto';

export const subscriptionInfoResponseMapper = (
  access: UserAccess,
  plan: Plan,
  userUsage: UserUsage,
): SubscriptionInfoResponseDto => {
  return {
    plan: SubscriptionPlan[plan.id],
    aiCreditRemaining: plan.dailyQuotaCredits - userUsage.usedAmount,
    dailyAiCreditLimit: plan.dailyQuotaCredits,
    createdAt: access.createdAt,
    expiresAt: access.expiresAt,
  };
};
