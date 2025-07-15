import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/auth/optional-jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import Stripe from 'stripe';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session';
import { StripeCoreService } from './stripe-core.service';
import { StripeService } from './stripe.service';

@Controller('api/stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly stripeCoreService: StripeCoreService,
    private readonly configService: ConfigService,
  ) {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret && nodeEnv !== 'production') {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET not set. Local webhook verification might use a dummy or fail if StripeCoreService relies on it solely from config.',
      );
    }
    this.logger.log('Stripe Controller Initialized.');
  }

  @Post('create-checkout-session')
  @UseGuards(OptionalJwtAuthGuard)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async createCheckoutSession(
    @Body() createCheckoutDto: CreateCheckoutSessionDto,
    @CurrentUser() user: CurrentUserType | null,
  ) {
    this.logger.log(
      `Received create-checkout-session request for user: ${user?.id || createCheckoutDto.email || 'Guest'}, Plan ID: ${createCheckoutDto.planId}`,
    );
    try {
      const dtoWithUserContext = {
        ...createCheckoutDto,
        userId: user?.id,
        email: user?.email || createCheckoutDto.email,
      };

      const sessionResult =
        await this.stripeService.createCheckoutOrPortalSession(
          dtoWithUserContext,
        );

      return sessionResult;
    } catch (error) {
      this.logger.error(
        `Error in createCheckoutSession controller: ${(error as Error).message}`,
        (error as Error).stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        (error as Error).message || 'Failed to create session.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-customer-portal-session')
  @UseGuards(OptionalJwtAuthGuard)
  async createPortalSession(@CurrentUser() user: CurrentUserType) {
    if (!user || !user.id || !user.email) {
      throw new BadRequestException('User context is required.');
    }
    this.logger.log(
      `Received create-customer-portal-session request for user: ${user.id}`,
    );

    try {
      const portalSession =
        await this.stripeService.createCustomerPortalSessionForUser(user.id);
      return { url: portalSession.url };
    } catch (error) {
      this.logger.error(
        `Error creating portal session for user ${user.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        (error as Error).message || 'Failed to create customer portal session.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!this.stripeCoreService.isProductionEnv() && !signature) {
      this.logger.warn(
        'Webhook request received without signature in non-production. This might be a simulated event or a misconfiguration.',
      );
    } else if (!signature) {
      throw new BadRequestException('Missing Stripe signature header');
    }

    const rawBody = request.body;
    this.logger.debug(
      `Webhook body type: ${typeof rawBody}, isBuffer: ${Buffer.isBuffer(rawBody)}, length: ${rawBody?.length || 'N/A'}`,
    );

    if (!rawBody) {
      this.logger.error(
        'Webhook received without raw body. Ensure raw body parsing is enabled for this route. Expected request.body to be a Buffer.',
      );
      throw new BadRequestException(
        'Webhook error: Missing raw body. Configure raw body parsing for this endpoint.',
      );
    }

    // Enforce raw Buffer input for Stripe webhook body
    if (!Buffer.isBuffer(rawBody)) {
      this.logger.error(
        `Webhook received with invalid body format. Body type: ${typeof rawBody}. Ensure raw body parsing is enabled for this route. Expected request.body to be a Buffer.`,
      );
      throw new BadRequestException(
        'Webhook error: Invalid body format. Configure raw body parsing for this endpoint.',
      );
    }
    const bodyForStripe: Buffer = rawBody;

    let event: Stripe.Event;
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!webhookSecret && this.stripeCoreService.isProductionEnv()) {
      this.logger.error(
        'CRITICAL: STRIPE_WEBHOOK_SECRET is not configured in production for webhook verification.',
      );
      throw new HttpException(
        'Webhook secret not configured.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const secretToUse =
      webhookSecret ||
      (this.stripeCoreService.isProductionEnv()
        ? ''
        : 'whsec_test_dummy_secret');

    try {
      event = this.stripeCoreService
        .getStripeClient()
        .webhooks.constructEvent(bodyForStripe, signature, secretToUse);
      this.logger.log(
        `Webhook event successfully constructed: ${event.id}, Type: ${event.type}`,
      );
    } catch (err) {
      this.logger.error(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
      throw new BadRequestException(`Webhook error: ${(err as Error).message}`);
    }

    this.stripeService.handleWebhookEvent(event).catch((processingError) => {
      this.logger.error(
        `Async error processing webhook ${event.id} (Type: ${event.type}):`,
        processingError,
      );
    });

    return { received: true };
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @Get('income-summary')
  async getIncomeSummary() {
    this.logger.log('Received request for income summary.');
    try {
      const summary = await this.stripeService.getIncomeSummary();
      return summary;
    } catch (error) {
      this.logger.error(
        `Error fetching income summary in controller: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new HttpException(
        'Failed to retrieve Stripe income summary.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
