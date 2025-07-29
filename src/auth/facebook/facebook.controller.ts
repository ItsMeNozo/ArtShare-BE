import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { FacebookApiService } from 'src/facebook-api/facebook-api.service';
import { SharePlatform } from 'src/generated';
import { PlatformService } from 'src/platform/platform.service';
import { CurrentUser } from '../decorators/users.decorator';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { CurrentUserType } from '../types/current-user.type';
import { FacebookAuthService } from './facebook.service';

@Controller('facebook-integration')
export class FacebookController {
  private readonly logger = new Logger(FacebookController.name);
  private readonly defaultSuccessRedirectUrl: string;
  private readonly defaultErrorRedirectUrl: string;

  constructor(
    private readonly facebookAuthService: FacebookAuthService,
    private readonly facebookApiService: FacebookApiService,
    private readonly configService: ConfigService,
    private readonly platformService: PlatformService,
  ) {
    this.defaultSuccessRedirectUrl =
      this.configService.get<string>('FRONTEND_URL_FB_SETUP_SUCCESS') ||
      'http://localhost:5173/settings?status=success';
    this.defaultErrorRedirectUrl =
      this.configService.get<string>('FRONTEND_URL_FB_SETUP_ERROR') ||
      'http://localhost:5173/settings?status=error';
  }

  /**
   * @description Called by frontend AJAX to get the Facebook redirect URL.
   * User must be logged into our application using JWT.
   */
  @UseGuards(JwtAuthGuard)
  @Get('initiate-connection-url')
  async getFacebookInitiationUrl(
    @CurrentUser() user: CurrentUserType,
    @Query('successUrl') successUrl?: string,
    @Query('errorUrl') errorUrl?: string,
  ) {
    const userId = user?.id;
    if (!userId) {
      this.logger.warn(
        'User ID not available from CurrentUser decorator in getFacebookInitiationUrl.',
      );
      throw new UnauthorizedException(
        'User authentication invalid or ID not available.',
      );
    }

    try {
      const finalSuccessUrl = successUrl || this.defaultSuccessRedirectUrl;
      const finalErrorUrl = errorUrl || this.defaultErrorRedirectUrl;

      this.logger.log(`Using success redirect URL: ${finalSuccessUrl}`);
      this.logger.log(`Using error redirect URL: ${finalErrorUrl}`);

      const { loginUrl } = await this.facebookAuthService.getFacebookLoginUrl(
        userId,
        finalSuccessUrl,
        finalErrorUrl,
      );

      return { facebookLoginUrl: loginUrl };
    } catch (error) {
      this.logger.error(
        `Error getting Facebook initiation URL for user ${userId}:`,
        (error as any).message,
      );
      throw new InternalServerErrorException(
        'Could not initiate Facebook connection.',
      );
    }
  }

  /**
   * @description Facebook OAuth callback endpoint. Not directly called by users.
   * This endpoint IS NOT protected by your app's AuthGuard.
   * The 'state' parameter (JWT) handles security for this callback.
   */
  @Get('callback')
  async facebookCallback(
    @Query('code') code: string,
    @Query('state') stateJwt: string,
    @Query('error') fbError: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    if (fbError) {
      this.logger.error(
        `Facebook callback error: ${fbError} - ${errorDescription}`,
      );

      return res.redirect(this.defaultErrorRedirectUrl);
    }

    if (!code || !stateJwt) {
      this.logger.warn("Facebook callback missing 'code' or 'state'.");
      return res.redirect(this.defaultErrorRedirectUrl);
    }

    let errorRedirectUrl = this.defaultErrorRedirectUrl;

    try {
      const callbackData = await this.facebookAuthService.processOauthCallback(
        code,
        stateJwt,
      );

      errorRedirectUrl =
        callbackData.errorRedirectUrl || this.defaultErrorRedirectUrl;

      this.logger.log(
        `Auth successful for user ${callbackData.userId}. Syncing platforms.`,
      );

      await this.platformService.synchronizePlatforms({
        userId: callbackData.userId,
        platformName: SharePlatform.FACEBOOK,
        pagesFromApi: callbackData.pagesFromApi,
        facebookAccountId: callbackData.facebookAccountId,
      });

      this.logger.log(`Sync complete. Redirecting to success URL.`);

      res.redirect(
        callbackData.successRedirectUrl || this.defaultSuccessRedirectUrl,
      );
    } catch (error) {
      this.logger.error(
        'Critical error during Facebook callback process:',
        (error as Error).message,
      );

      res.redirect(errorRedirectUrl);
    }
  }

  /**
   * @description Gets all connected Facebook Accounts and their associated Pages (Platforms).
   * User must be logged into our application using JWT.
   */
  @UseGuards(JwtAuthGuard)
  @Get('account-info')
  async getFacebookAccountInfo(@CurrentUser() user: CurrentUserType) {
    const userId = user?.id;
    if (!userId) {
      throw new UnauthorizedException(
        'User authentication invalid or ID not available.',
      );
    }

    try {
      const accountsInfo =
        await this.facebookApiService.getFacebookAccountInfo(userId);

      if (!accountsInfo || accountsInfo.length === 0) {
        throw new NotFoundException(
          'No Facebook accounts connected for this user.',
        );
      }

      return accountsInfo;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error getting Facebook account info for user ${userId}:`,
        (error as any).message,
      );
      throw new InternalServerErrorException(
        'Could not retrieve Facebook account information.',
      );
    }
  }
}
