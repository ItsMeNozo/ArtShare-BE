import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { PaidAccessLevel, Plan, User } from 'src/generated';
import { UsageService } from 'src/usage/usage.service';
import Stripe from 'stripe';
import { StripeCoreService } from './stripe-core.service';
import { StripeDbService } from './stripe-db.service';

export interface SubscriptionProcessingResult {
  user?: User;
  plan?: Plan;
  subscription?: Stripe.Subscription | null;
  accessRecordUpdated: boolean;
}

interface SubscriptionDetails {
  status: Stripe.Subscription.Status;
  priceId: string | null;
  productId: string | null;
  periodStartTimestamp: number | null;
  periodEndTimestamp: number | null;
  cancelAtPeriodEnd: boolean;
  rawSubscription?: Stripe.Subscription;
}

@Injectable()
export class StripeWebhookProcessorService {
  private logger = new Logger(StripeWebhookProcessorService.name);

  constructor(
    private readonly stripeCoreService: StripeCoreService,
    private readonly stripeDbService: StripeDbService,
    private readonly usageService: UsageService,
  ) {}

  private async _downgradeUserToFreeTier(
    user: User,
    canceledStripeSubscription?:
      | Stripe.Subscription
      | {
          id: string;
          customer: string | Stripe.Customer | Stripe.DeletedCustomer | null;
        },
  ): Promise<SubscriptionProcessingResult> {
    const canceledSubIdForLog = canceledStripeSubscription?.id;
    this.logger.log(
      `Downgrading user ${user.id} to free tier. Canceled Stripe Sub ID (if any): ${canceledSubIdForLog || 'N/A'}`,
    );

    const currentStripeCustomerId = user.stripeCustomerId || null;

    await this.stripeDbService.upsertUserAccess({
      userId: user.id,
      planId: PaidAccessLevel.FREE,
      expiresAt: new Date('9999-12-31T23:59:59.999Z'),
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCustomerId: currentStripeCustomerId,
      cancelAtPeriodEnd: false,
    });

    this.logger.log(
      `User ${user.id} successfully downgraded to free plan. User's Stripe Customer ID: ${currentStripeCustomerId || 'None'}.`,
    );
    return { user, accessRecordUpdated: true };
  }

  private _getPeriodTimestampsFromInvoice(
    invoice: Stripe.Invoice | string | null | undefined,
  ): { start: number | null; end: number | null } {
    let periodStartTimestamp: number | null = null;
    let periodEndTimestamp: number | null = null;

    if (
      invoice &&
      typeof invoice === 'object' &&
      invoice.lines?.data[0]?.period
    ) {
      const firstLineItemPeriod = invoice.lines.data[0].period;
      periodStartTimestamp = firstLineItemPeriod.start;
      periodEndTimestamp = firstLineItemPeriod.end;
    }
    return { start: periodStartTimestamp, end: periodEndTimestamp };
  }

  private async _getSubscriptionDetails(
    subscriptionId: string | null | undefined,
    isSimulated: boolean,
    simulatedPriceId?: string | null,
    simulatedSubscriptionStatus?: Stripe.Subscription.Status,
  ): Promise<SubscriptionDetails | null> {
    if (!isSimulated) {
      if (!subscriptionId) {
        this.logger.error(
          'Non-simulated event requires a subscriptionId for details extraction.',
        );
        return null;
      }
      const stripeSubscription =
        await this.stripeCoreService.retrieveSubscription(subscriptionId);

      const firstItem = stripeSubscription.items?.data[0];
      const priceObj = firstItem?.price as Stripe.Price | undefined;
      const productObj = priceObj?.product;
      let periodStartTimestamp = firstItem?.current_period_start;
      let periodEndTimestamp = firstItem?.current_period_end;

      if (
        (stripeSubscription.status === 'active' ||
          stripeSubscription.status === 'trialing') &&
        (typeof periodStartTimestamp !== 'number' ||
          typeof periodEndTimestamp !== 'number')
      ) {
        this.logger.warn(
          `Subscription ${subscriptionId} missing direct period_start/end. Checking latest_invoice.`,
        );
        const invoiceTimestamps = this._getPeriodTimestampsFromInvoice(
          stripeSubscription.latest_invoice,
        );
        if (
          typeof periodStartTimestamp !== 'number' &&
          typeof invoiceTimestamps.start === 'number'
        ) {
          periodStartTimestamp = invoiceTimestamps.start;
        }
        if (
          typeof periodEndTimestamp !== 'number' &&
          typeof invoiceTimestamps.end === 'number'
        ) {
          periodEndTimestamp = invoiceTimestamps.end;
        }

        if (
          typeof periodStartTimestamp !== 'number' ||
          typeof periodEndTimestamp !== 'number'
        ) {
          this.logger.error(
            `Missing period start/end from subscription ${subscriptionId} or its latest invoice for an active/trialing status. Start: ${periodStartTimestamp}, End: ${periodEndTimestamp}`,
          );
        }
      }

      return {
        status: stripeSubscription.status,
        priceId: priceObj?.id || null,
        productId: productObj
          ? typeof productObj === 'string'
            ? productObj
            : productObj.id
          : null,
        periodStartTimestamp,
        periodEndTimestamp,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        rawSubscription: stripeSubscription,
      };
    } else {
      if (!simulatedPriceId) {
        this.logger.error(
          'Simulation error: priceId is required for simulated activation.',
        );
        throw new BadRequestException(
          'Simulation error: priceId is required for simulated activation.',
        );
      }

      const price =
        await this.stripeCoreService.retrievePrice(simulatedPriceId);
      const productId =
        typeof price.product === 'string' ? price.product : price.product.id;

      const now = new Date();
      const periodStartTimestamp = Math.floor(now.getTime() / 1000);
      const endDate = new Date(now);
      if (price.recurring?.interval === 'year')
        endDate.setFullYear(endDate.getFullYear() + 1);
      else endDate.setMonth(endDate.getMonth() + 1);
      const periodEndTimestamp = Math.floor(endDate.getTime() / 1000);

      return {
        status: simulatedSubscriptionStatus || 'active',
        priceId: simulatedPriceId,
        productId: productId,
        periodStartTimestamp,
        periodEndTimestamp,
        cancelAtPeriodEnd: false,
      };
    }
  }

  async processSubscriptionActivation(
    customerId: string | null | undefined,
    subscriptionId: string | null | undefined,
    clientReferenceId: string | null | undefined,
    metadataUserId: string | null | undefined,
    isSimulated: boolean = false,
    simulatedPriceId?: string | null,
    simulatedSubscriptionStatus?: Stripe.Subscription.Status,
    eventType?: string,
  ): Promise<SubscriptionProcessingResult> {
    const userIdToFind = clientReferenceId || metadataUserId;
    const subIdLabel =
      subscriptionId || (isSimulated ? '(simulated)' : '(missing_id)');
    this.logger.log(
      `Processing subscription event. Cust: ${customerId}, Sub: ${subIdLabel}, UserRef: ${userIdToFind}, Simulated: ${isSimulated}, EventType: ${eventType}`,
    );

    if (!customerId && !userIdToFind) {
      this.logger.error(
        'No customerId or UserRef provided for subscription processing.',
      );
      return { accessRecordUpdated: false };
    }
    if (!subscriptionId && !isSimulated) {
      this.logger.error('Non-simulated event requires a subscriptionId.');
      return { accessRecordUpdated: false };
    }

    let user: User | null = null;
    try {
      user = await this.stripeDbService.findUserByStripeData(
        customerId,
        userIdToFind,
      );
      if (!user) {
        this.logger.error(
          `User not found via customerId '${customerId}' or internalRef '${userIdToFind}'. Cannot proceed for Sub ${subIdLabel}.`,
        );
        return { accessRecordUpdated: false };
      }

      if (customerId && user.stripeCustomerId !== customerId) {
        await this.stripeDbService.updateUserStripeCustomerId(
          user.id,
          customerId,
        );
        user.stripeCustomerId = customerId;
      }

      const subDetails = await this._getSubscriptionDetails(
        subscriptionId,
        isSimulated,
        simulatedPriceId,
        simulatedSubscriptionStatus,
      );

      if (!subDetails || !subDetails.status) {
        this.logger.error(
          `Could not determine subscription details or status for ${subIdLabel}.`,
        );
        return { accessRecordUpdated: false };
      }

      const {
        status,
        priceId: determinedPriceId,
        productId: determinedProductId,
        periodStartTimestamp,
        periodEndTimestamp,
        cancelAtPeriodEnd: cancelAtPeriodEndFlag,
        rawSubscription: stripeSubscription,
      } = subDetails;

      if (status === 'active' || status === 'trialing') {
        if (
          !determinedProductId ||
          periodEndTimestamp === null ||
          !determinedPriceId ||
          periodStartTimestamp === null
        ) {
          this.logger.error(
            `Incomplete subscription details for activation/update of Sub ${subIdLabel}. ProductID: ${determinedProductId}, PriceID: ${determinedPriceId}, PeriodEnd: ${periodEndTimestamp}, PeriodStart: ${periodStartTimestamp}`,
          );
          throw new InternalServerErrorException(
            'Incomplete subscription details for activation/update.',
          );
        }

        const plan =
          await this.stripeDbService.findPlanByStripeProductId(
            determinedProductId,
          );
        if (!plan) {
          this.logger.error(
            `Configuration error: Plan not found in DB for Stripe Product ID ${determinedProductId}. Sub ${subIdLabel}.`,
          );
          throw new InternalServerErrorException(
            `Configuration error: Plan not found for Stripe Product ID ${determinedProductId}.`,
          );
        }

        const cycleStart = new Date(periodStartTimestamp * 1000);
        const cycleEnd = new Date(periodEndTimestamp * 1000);

        const price = await this.stripeCoreService.retrievePrice(
          determinedPriceId!,
        );
        const isYearlyPlan = price.recurring?.interval === 'year';
        const resetDay = cycleStart.getDate();
        const actualSubscriptionId = isSimulated
          ? `sim_${Date.now()}`
          : subscriptionId!;
        const actualCustomerId = customerId || user.stripeCustomerId!;

        await this.stripeDbService.upsertUserAccess({
          userId: user.id,
          planId: plan.id,
          expiresAt: cycleEnd,
          stripeSubscriptionId: actualSubscriptionId,
          stripePriceId: determinedPriceId,
          stripeCustomerId: actualCustomerId,
          cancelAtPeriodEnd: cancelAtPeriodEndFlag,
          monthlyResetDay: isYearlyPlan ? resetDay : null,
        });

        if (!isYearlyPlan) {
          try {
            await this.usageService.resetUsageForNewCycle(
              user.id,
              FeatureKey.AI_CREDITS,
              cycleStart,
              cycleEnd,
            );
            this.logger.log(
              `Directly reset usage for monthly plan for user ${user.id}.`,
            );
          } catch (usageError) {
            this.logger.error(
              `CRITICAL: UserAccess was updated for monthly plan (user ${user.id}) but usage reset failed.`,
              usageError instanceof Error ? usageError.stack : usageError,
            );
          }
        } else {
          this.logger.log(
            `Yearly plan activated for user ${user.id}. Monthly reset scheduled for day ${resetDay}.`,
          );

          const firstMonthEnd = new Date(cycleStart);
          firstMonthEnd.setMonth(firstMonthEnd.getMonth() + 1);

          await this.usageService.resetUsageForNewCycle(
            user.id,
            FeatureKey.AI_CREDITS,
            cycleStart,
            firstMonthEnd,
          );
        }

        return {
          user,
          plan,
          subscription: stripeSubscription || null,
          accessRecordUpdated: true,
        };
      } else if (
        ['canceled', 'unpaid', 'incomplete_expired', 'past_due'].includes(
          status,
        )
      ) {
        const subForDowngrade = stripeSubscription || {
          id: subscriptionId || 'simulated_ended_sub',
          customer: customerId || user.stripeCustomerId!,
        };

        const downgradeResult = await this._downgradeUserToFreeTier(
          user,
          subForDowngrade,
        );
        return {
          user: downgradeResult.user,
          subscription: stripeSubscription || null,
          accessRecordUpdated: downgradeResult.accessRecordUpdated,
        };
      } else {
        this.logger.warn(
          `Unhandled subscription status '${status}' for Sub ${subIdLabel}. No action taken on UserAccess.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error in processSubscriptionActivation for Sub ${subIdLabel} (User ${user?.id}):`,
        error instanceof Error ? error.stack : error,
      );
      if (
        error instanceof InternalServerErrorException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to process subscription event due to an internal error.',
      );
    }
    return { accessRecordUpdated: false };
  }

  async processSubscriptionRenewal(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = typeof invoice.id === 'string' ? invoice.id : null;

    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id || null;
    const invoiceId = invoice.id;

    const metadataUserId = invoice.metadata?.userId as string | undefined;

    this.logger.log(
      `Handling renewal & usage reset for invoice.paid: ${invoiceId}, Sub: ${subscriptionId}, Cust: ${customerId}, MetaUserId: ${metadataUserId}`,
    );

    if (
      !subscriptionId ||
      !customerId ||
      !subscriptionId.startsWith('sub_') ||
      !customerId.startsWith('cus_')
    ) {
      this.logger.warn(
        `Invoice ${invoiceId} paid, but missing or invalid subscription or customer ID. Sub: ${subscriptionId}, Cust: ${customerId}. Cannot process renewal.`,
      );
      return;
    }

    try {
      const result = await this.processSubscriptionActivation(
        customerId,
        subscriptionId,
        null,
        metadataUserId,
        false,
        undefined,
        undefined,
        'invoice.paid',
      );

      if (!result.accessRecordUpdated) {
        this.logger.warn(
          `UserAccess not updated for Sub ${subscriptionId} during renewal (invoice ${invoiceId}). Review logs from processSubscriptionActivation.`,
        );
      } else {
        this.logger.log(
          `Successfully processed renewal for Sub ${subscriptionId} (Invoice ${invoiceId}). Access updated: ${result.accessRecordUpdated}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling subscription renewal for Sub ${subscriptionId} / Invoice ${invoiceId}:`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async processSubscriptionCancellation(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const subscriptionId = subscription.id;
    this.logger.log(
      `Processing cancellation (e.g., customer.subscription.deleted) for Stripe Subscription ID: ${subscriptionId}, Status: ${subscription.status}`,
    );

    if (!subscriptionId || !subscriptionId.startsWith('sub_')) {
      this.logger.error(
        `Invalid subscription ID received for cancellation: ${subscriptionId}`,
      );
      return;
    }

    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : (subscription.customer as Stripe.Customer)?.id;
    const metadataUserId = subscription.metadata?.userId as string | undefined;

    let user: User | null = null;

    if (customerId || metadataUserId) {
      user = await this.stripeDbService.findUserByStripeData(
        customerId,
        metadataUserId,
      );
    }

    if (user) {
      this.logger.log(
        `User ${user.id} found for subscription ${subscriptionId}. Proceeding to downgrade.`,
      );
      await this._downgradeUserToFreeTier(user, subscription);
    } else {
      this.logger.warn(
        `User not found by customerId ('${customerId}') or metadataUserId ('${metadataUserId}') for subscription ${subscriptionId} during cancellation. Checking for UserAccess record by subscription ID.`,
      );

      const accessRecord =
        await this.stripeDbService.findUserAccessBySubscriptionId(
          subscriptionId,
        );
      if (accessRecord?.userId) {
        this.logger.warn(
          `Found UserAccess for sub ${subscriptionId}, linked to user ${accessRecord.userId}. Attempting to find and downgrade this user.`,
        );

        const orphanedUser = await this.stripeDbService.findUserByStripeData(
          null,
          accessRecord.userId,
        );
        if (orphanedUser) {
          await this._downgradeUserToFreeTier(orphanedUser, subscription);
        } else {
          this.logger.error(
            `Could not find user ${accessRecord.userId} (from orphaned UserAccess) for sub ${subscriptionId}. Cannot downgrade. Potential data inconsistency.`,
          );
        }
      } else {
        this.logger.warn(
          `No UserAccess record found for subscription ${subscriptionId}. No specific user to downgrade. The subscription might have been for a user not fully provisioned, or access already removed/downgraded.`,
        );
      }
    }
  }
}
