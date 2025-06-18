import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CurrentUser } from '../decorators/users.decorator';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { CurrentUserType } from '../types/current-user.type';
import { FacebookAuthService } from './facebook.service';

@Controller('facebook-integration')
export class FacebookController {
  private readonly logger = new Logger(FacebookController.name);
  private readonly defaultFrontendSuccessRedirectUrl: string;
  private readonly defaultFrontendErrorRedirectUrl: string;

  constructor(
    private readonly facebookAuthService: FacebookAuthService,
    private readonly configService: ConfigService,
  ) {
    this.defaultFrontendSuccessRedirectUrl =
      this.configService.get<string>('FRONTEND_URL_FB_SETUP_SUCCESS') ||
      'http://localhost:5173/settings?status=success';
    this.defaultFrontendErrorRedirectUrl =
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
      const finalSuccessUrl =
        successUrl || this.defaultFrontendSuccessRedirectUrl;
      const finalErrorUrl = errorUrl || this.defaultFrontendErrorRedirectUrl;

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
    this.logger.log(`Received State JWT: ${stateJwt}`);

    const {
      successRedirectUrl = this.defaultFrontendSuccessRedirectUrl,
      errorRedirectUrl = this.defaultFrontendErrorRedirectUrl,
    } = await this.facebookAuthService.getRedirectUrlsFromState(stateJwt);

    if (fbError) {
      this.logger.error(
        `Facebook callback error: ${fbError} - ${errorDescription}`,
      );
      return res.redirect(errorRedirectUrl);
    }

    if (!code || !stateJwt) {
      this.logger.warn(`Facebook callback missing code or state JWT.`);

      return res.redirect(errorRedirectUrl);
    }

    try {
      await this.facebookAuthService.handleFacebookCallback(code, stateJwt);

      this.logger.log(
        `Facebook OAuth callback processed. Redirecting to success URL: ${successRedirectUrl}`,
      );

      res.redirect(successRedirectUrl);
    } catch (error) {
      this.logger.error(
        `Error processing Facebook callback:`,
        (error as any).message,
      );

      res.redirect(errorRedirectUrl);
    }
  }
}
