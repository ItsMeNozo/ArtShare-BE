import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeCoreService {
  private stripe: Stripe;
  private logger = new Logger(StripeCoreService.name);
  private frontendUrl: string;
  private isProd: boolean;
  private runSim: boolean;

  constructor(private configService: ConfigService) {
    this.frontendUrl =
      (this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173') + '/app-subscription?stripe_portal_return=true';
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!secretKey) {
      throw new Error('Config error: STRIPE_SECRET_KEY missing.');
    }

    this.isProd = this.configService.get<string>('NODE_ENV') === 'production';

    if (!webhookSecret && this.isProd) {
      throw new Error(
        'Config error: STRIPE_WEBHOOK_SECRET missing in production.',
      );
    } else if (!webhookSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET not set. Real webhooks will fail verification if received.',
      );
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-04-30.basil',
      typescript: true,
    });

    const runSimEnv = this.configService
      .get<string>('RUN_STRIPE_SIMULATION')
      ?.toLowerCase();
    this.runSim = !this.isProd && runSimEnv === 'true';

    this.logger.log(
      `Stripe Core Service Initialized. Production: ${this.isProd}. Run Simulation: ${this.runSim}`,
    );
  }

  getStripeClient(): Stripe {
    return this.stripe;
  }

  getFrontendUrl(): string {
    return this.frontendUrl;
  }

  isSimulationEnabled(): boolean {
    return this.runSim;
  }

  isProductionEnv(): boolean {
    return this.isProd;
  }

  async retrieveSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice.lines.data', 'items.data.price.product'],
      });
    } catch (error) {
      this.logger.error(
        `Stripe retrieveSubscription failed for ${subscriptionId}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Stripe retrieve subscription failed: ${(error as Error).message}`,
      );
    }
  }

  async retrievePrice(priceId: string): Promise<Stripe.Price> {
    try {
      return await this.stripe.prices.retrieve(priceId, {
        expand: ['product'],
      });
    } catch (error) {
      this.logger.error(`Stripe retrievePrice failed for ${priceId}:`, error);
      throw new InternalServerErrorException(
        `Stripe retrieve price failed: ${(error as Error).message}`,
      );
    }
  }

  async listCustomersByEmail(
    email: string,
  ): Promise<Stripe.ApiList<Stripe.Customer>> {
    return this.stripe.customers.list({ email, limit: 1 });
  }

  async createCustomer(
    params: Stripe.CustomerCreateParams,
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.create(params);
  }

  async createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session> {
    try {
      return await this.stripe.checkout.sessions.create(params);
    } catch (error) {
      this.logger.error('Error creating checkout session:', error);
      if (error instanceof Stripe.errors.StripeError) {
        throw new InternalServerErrorException(
          `Stripe Error creating checkout session: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        'Could not create payment session.',
      );
    }
  }

  async createBillingPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams,
  ): Promise<Stripe.BillingPortal.Session> {
    try {
      return await this.stripe.billingPortal.sessions.create(params);
    } catch (error) {
      this.logger.error(
        `Stripe Error creating portal session for ${params.customer}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to create Stripe customer portal session.',
      );
    }
  }
}
