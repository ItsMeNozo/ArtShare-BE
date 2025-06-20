import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/generated';
import Stripe from 'stripe';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session';
import { StripeCoreService } from './stripe-core.service';
import { StripeDbService } from './stripe-db.service';
import { StripeWebhookProcessorService } from './stripe-webhook-processor.service';
import { DailyBreakdown } from './types';

@Injectable()
export class StripeService {
  private logger = new Logger(StripeService.name);
  private readonly planToPriceIdMap: Record<string, string>;

  constructor(
    private readonly stripeCoreService: StripeCoreService,
    private readonly stripeDbService: StripeDbService,
    private readonly stripeWebhookProcessorService: StripeWebhookProcessorService,
    private readonly configService: ConfigService,
  ) {
    this.planToPriceIdMap = {
      artist_monthly: this.configService.get<string>(
        'STRIPE_ARTIST_MONTHLY_PRICE_ID',
        '',
      ),
      artist_yearly: this.configService.get<string>(
        'STRIPE_ARTIST_YEARLY_PRICE_ID',
        '',
      ),
      studio_monthly: this.configService.get<string>(
        'STRIPE_STUDIO_MONTHLY_PRICE_ID',
        '',
      ),
      studio_yearly: this.configService.get<string>(
        'STRIPE_STUDIO_YEARLY_PRICE_ID',
        '',
      ),
    };
  }

  private async getStripePriceIdFromPlanId(
    internalPlanId: string,
  ): Promise<string> {
    const stripePriceId = this.planToPriceIdMap[internalPlanId];

    if (!stripePriceId) {
      this.logger.error(
        `Invalid planId: '${internalPlanId}'. No corresponding Stripe Price ID found in the mapping.`,
      );
      throw new InternalServerErrorException(
        `The selected plan (${internalPlanId}) is not available.`,
      );
    }

    this.logger.log(
      `Resolved planId '${internalPlanId}' to Stripe Price ID: ${stripePriceId}`,
    );
    return stripePriceId;
  }

  async createCheckoutOrPortalSession(
    dto: CreateCheckoutSessionDto,
  ): Promise<{ url: string | null; type: 'checkout' | 'portal' }> {
    const { email, userId, planId } = dto;
    const priceId = await this.getStripePriceIdFromPlanId(planId);
    const userIdentifier = userId || email || 'Guest';
    this.logger.log(
      `Initiating session for Price ID: ${planId}, user: ${userIdentifier}`,
    );

    let userRecord: User | null = null;
    let customerId: string | undefined | null = undefined;

    if (userId) {
      userRecord = await this.stripeDbService.findUserByStripeData(
        null,
        userId,
      );
      customerId = userRecord?.stripe_customer_id;
    }
    if (!userRecord && email) {
      userRecord = await this.stripeDbService.findUserByEmail(email);
      customerId = userRecord?.stripe_customer_id;
    }

    if (userRecord && !customerId && email) {
      const customers =
        await this.stripeCoreService.listCustomersByEmail(email);
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        await this.stripeDbService.updateUserStripeCustomerId(
          userRecord.id,
          customerId,
        );
      }
    }

    if (!customerId && email) {
      const newCustomerParams: Stripe.CustomerCreateParams = { email };
      if (userRecord?.full_name) newCustomerParams.name = userRecord.full_name;
      if (userRecord?.id || userId)
        newCustomerParams.metadata = { userId: userRecord?.id || userId || '' };

      const newCustomer =
        await this.stripeCoreService.createCustomer(newCustomerParams);
      customerId = newCustomer.id;
      if (userRecord) {
        await this.stripeDbService.updateUserStripeCustomerId(
          userRecord.id,
          customerId,
        );
      }
    }

    if (!customerId) {
      throw new BadRequestException(
        'Cannot initiate session without customer details (email or identified user).',
      );
    }

    let hasActiveNonCanceledSubscription = false;
    if (userRecord) {
      const activeAccess = await this.stripeDbService.findUserAccess(
        userRecord.id,
      );
      if (
        activeAccess &&
        activeAccess.expiresAt &&
        activeAccess.expiresAt > new Date() &&
        !activeAccess.cancelAtPeriodEnd
      ) {
        hasActiveNonCanceledSubscription = true;
        this.logger.log(
          `User ${userRecord.id} has an active, non-canceled subscription. Redirecting to Portal.`,
        );
      }
    }

    if (hasActiveNonCanceledSubscription) {
      const portalSession =
        await this.stripeCoreService.createBillingPortalSession({
          customer: customerId,
          return_url: this.stripeCoreService.getFrontendUrl(),
        });
      return { url: portalSession.url, type: 'portal' };
    } else {
      this.logger.log(
        `Proceeding with Checkout Session for customer ${customerId}, Price ID: ${priceId}`,
      );

      try {
        await this.stripeCoreService.retrievePrice(priceId);
      } catch (priceError) {
        this.logger.error(
          `Price ID ${priceId} not found on Stripe.`,
          priceError,
        );
        throw new BadRequestException(`Invalid subscription plan selected.`);
      }

      const devSuffix = '+location_VN';
      const isDevelopment =
        this.configService.get<string>('NODE_ENV') === 'development';
      let customerEmailForStripe: string | undefined = email;
      if (isDevelopment && customerEmailForStripe) {
        const emailParts = customerEmailForStripe.split('@');
        if (emailParts.length === 2) {
          customerEmailForStripe = `${emailParts[0]}${devSuffix}@${emailParts[1]}`;
        } else {
          console.warn(
            `Received email in unexpected format, cannot add dev suffix: ${customerEmailForStripe}`,
          );
        }
      }

      const checkoutSession =
        await this.stripeCoreService.createCheckoutSession({
          client_reference_id: userRecord?.id || userId || undefined,
          metadata: { userId: userRecord?.id || userId || '' },
          payment_method_types: ['card'],
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          allow_promotion_codes: true,
          customer_email: customerEmailForStripe,
          success_url: `${this.stripeCoreService.getFrontendUrl()}`,
          cancel_url: `${this.stripeCoreService.getFrontendUrl()}`,
        });
      this.logger.log(`Created checkout session: ${checkoutSession.id}`);

      if (this.stripeCoreService.isSimulationEnabled() && checkoutSession.id) {
        this.logger.warn(
          `DEV MODE (SIMULATION ENABLED): Simulating 'checkout.session.completed' for Session ${checkoutSession.id}`,
        );

        setTimeout(async () => {
          this.logger.log(
            `DEV SIM: Running simulated activation for Session ${checkoutSession.id}, Price: ${priceId}, Customer: ${customerId}`,
          );
          try {
            const simulatedSubscriptionId = `sub_sim_${Date.now()}`;

            await this.stripeWebhookProcessorService.processSubscriptionActivation(
              customerId,
              simulatedSubscriptionId,
              checkoutSession.client_reference_id,
              checkoutSession.metadata?.userId,
              true,
              priceId,
              'active',
              'checkout.session.completed',
            );
            this.logger.log(
              `DEV SIM: Simulated activation complete for Session ${checkoutSession.id}`,
            );
          } catch (simError) {
            this.logger.error(
              `DEV SIM: Error during simulated activation for Session ${checkoutSession.id}:`,
              simError,
            );
          }
        }, 4000);
      }
      return { url: checkoutSession.url, type: 'checkout' };
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Received Stripe webhook event: ${event.type}`);
    let relevantSubscription: Stripe.Subscription | undefined;
    let customerId: string;
    let subscriptionId: string;

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        if (
          session.mode === 'subscription' &&
          session.subscription &&
          session.customer
        ) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;
          const custId =
            typeof session.customer === 'string'
              ? session.customer
              : session.customer.id;

          await this.stripeWebhookProcessorService.processSubscriptionActivation(
            custId,
            subId,
            session.client_reference_id,
            session.metadata?.userId,
            false,
            undefined,
            undefined,
            event.type,
          );
        } else {
          this.logger.warn(
            `Checkout session ${session.id} completed but not a subscription or missing details. Mode: ${session.mode}, Sub: ${session.subscription ? 'Present' : 'Missing'}, Cust: ${session.customer ? 'Present' : 'Missing'}`,
          );
        }
        break;

      case 'invoice.paid':
        const invoice = event.data.object;
        this.logger.log(
          `Processing invoice.paid for invoice ID: ${invoice.id}, Subscription: ${invoice.id}, Customer: ${invoice.customer}`,
        );

        if (invoice.id && invoice.customer) {
          await this.stripeWebhookProcessorService.processSubscriptionRenewal(
            invoice,
          );
        } else {
          this.logger.warn(
            `Invoice ${invoice.id} 'invoice.paid' event received, but missing critical details. Paid: ${invoice.id}, Subscription ID: ${invoice.id || 'N/A'}, Customer ID: ${invoice.customer || 'N/A'}. Billing Reason: ${invoice.billing_reason}`,
          );
        }
        break;

      case 'customer.subscription.updated':
        relevantSubscription = event.data.object as Stripe.Subscription;
        this.logger.log(
          `Processing customer.subscription.updated for subscription ID: ${relevantSubscription.id}, Status: ${relevantSubscription.status}`,
        );

        if (typeof relevantSubscription.customer === 'string') {
          customerId = relevantSubscription.customer;
        } else {
          customerId = relevantSubscription.customer.id;
        }
        subscriptionId = relevantSubscription.id;

        await this.stripeWebhookProcessorService.processSubscriptionActivation(
          customerId,
          subscriptionId,
          null,
          relevantSubscription.metadata?.userId,
          false,
          undefined,
          undefined,
          event.type,
        );

        break;

      case 'customer.subscription.deleted':
        relevantSubscription = event.data.object as Stripe.Subscription;
        this.logger.log(
          `Processing customer.subscription.deleted for subscription ID: ${relevantSubscription.id}`,
        );

        await this.stripeWebhookProcessorService.processSubscriptionCancellation(
          relevantSubscription,
        );
        break;

      default:
        this.logger.log(
          `Unhandled Stripe webhook event type: ${event.type}, ID: ${event.id}`,
        );
    }
  }

  async createCustomerPortalSessionForUser(
    userId: string,
  ): Promise<{ url: string }> {
    const userRecord = await this.stripeDbService.findUserByStripeData(
      null,
      userId,
    );

    if (!userRecord || !userRecord.stripe_customer_id) {
      this.logger.error(
        `User ${userId} requested portal session but has no Stripe Customer ID or user not found.`,
      );
      throw new NotFoundException(
        'Billing information not found for this user, or user does not exist.',
      );
    }

    const customerId = userRecord.stripe_customer_id;

    const portalSession =
      await this.stripeCoreService.createBillingPortalSession({
        customer: customerId,
        return_url: this.stripeCoreService.getFrontendUrl(),
      });
    this.logger.log(
      `Created Customer Portal session for user ${userId} / customer ${customerId}`,
    );
    return { url: portalSession.url };
  }

  async getIncomeSummary(): Promise<{
    totalIncome: number;
    currency: string;
    period: string;
    dailyBreakdown: DailyBreakdown[];
  }> {
    this.logger.log('Fetching monthly income summary with daily breakdown.');
    const stripe = this.stripeCoreService.getStripeClient();
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthName = today.toLocaleString('default', { month: 'long' });

    try {
      const transactions = await stripe.balanceTransactions.list({
        created: { gte: Math.floor(startOfMonth.getTime() / 1000) },
        type: 'charge',
        limit: 100,
      });
      const dailyTotals = new Map<string, number>();

      for (
        let d = new Date(startOfMonth);
        d <= today;
        d.setDate(d.getDate() + 1)
      ) {
        const dateString = d.toISOString().split('T')[0];
        dailyTotals.set(dateString, 0);
      }

      for (const tx of transactions.data) {
        const txDate = new Date(tx.created * 1000);
        const dateString = txDate.toISOString().split('T')[0];
        const currentTotal = dailyTotals.get(dateString) || 0;

        dailyTotals.set(dateString, currentTotal + tx.amount / 100);
      }

      const dailyBreakdown = Array.from(dailyTotals.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const totalIncome = dailyBreakdown.reduce(
        (sum, day) => sum + day.amount,
        0,
      );
      const currency =
        transactions.data.length > 0 ? transactions.data[0].currency : 'usd';

      return {
        totalIncome,
        currency: currency.toUpperCase(),
        period: `This month (${monthName})`,
        dailyBreakdown,
      };
    } catch (error) {
      this.logger.error(
        `Stripe API error in getIncomeSummary: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new Error(
        'Failed to communicate with Stripe API for income summary.',
      );
    }
  }
}
