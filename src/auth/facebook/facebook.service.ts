import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FacebookAccount, SharePlatform } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { ApiPageData } from 'src/platform/dtos/sync-platform-input.dto';
import { PlatformService } from 'src/platform/platform.service';
import { PrismaService } from 'src/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import {
  FacebookPagesApiResponse,
  FacebookStatePayload,
  FacebookUserTokenResponse,
} from './facebook.type';

@Injectable()
export class FacebookAuthService {
  private readonly logger = new Logger(FacebookAuthService.name);
  private readonly FB_APP_ID?: string;
  private readonly FB_APP_SECRET?: string;
  private readonly FB_REDIRECT_URI_PATH = '/facebook-integration/callback';
  private readonly FB_REDIRECT_URI: string;
  private readonly API_VERSION = 'v22.0';
  private readonly OAUTH_STATE_JWT_SECRET?: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly platformService: PlatformService,
    private readonly prisma: PrismaService,
  ) {
    this.FB_APP_ID = this.configService.get<string>('FACEBOOK_APP_ID');
    this.FB_APP_SECRET = this.configService.get<string>('FACEBOOK_APP_SECRET');
    const callbackBaseUrl =
      this.configService.get<string>('APP_URL_BASE') || 'http://localhost:3000';
    this.FB_REDIRECT_URI = `${callbackBaseUrl}${this.FB_REDIRECT_URI_PATH}`;

    this.OAUTH_STATE_JWT_SECRET =
      this.configService.get<string>('FACEBOOK_OAUTH_STATE_SECRET') ||
      this.configService.get<string>('AT_SECRET');

    if (!this.FB_APP_ID || !this.FB_APP_SECRET) {
      throw new Error('Facebook App credentials not configured.');
    }
    if (!this.OAUTH_STATE_JWT_SECRET) {
      throw new Error('Secret for Facebook OAuth State JWT not configured.');
    }
  }

  async getFacebookLoginUrl(
    userId: string,
    successRedirectUrl: string,
    errorRedirectUrl: string,
  ): Promise<{ loginUrl: string }> {
    const payload: FacebookStatePayload = {
      sub: userId,
      nonce: uuidv4(),
      purpose: 'facebook_page_connection_state',
      successRedirectUrl,
      errorRedirectUrl,
    };
    const stateJwt = await this.jwtService.signAsync(payload, {
      secret: this.OAUTH_STATE_JWT_SECRET,
      expiresIn: '10m',
    });

    const scopes = [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_manage_posts',
    ].join(',');
    const loginUrl = `https://www.facebook.com/${this.API_VERSION}/dialog/oauth?client_id=${this.FB_APP_ID}&redirect_uri=${encodeURIComponent(this.FB_REDIRECT_URI)}&state=${stateJwt}&scope=${scopes}&response_type=code`;

    this.logger.log(`Generated Facebook login URL for user ${userId}.`);
    return { loginUrl };
  }

  async getRedirectUrlsFromState(stateJwt: string): Promise<{
    successRedirectUrl?: string;
    errorRedirectUrl?: string;
  }> {
    if (!stateJwt) {
      return {};
    }
    try {
      const payload = await this.jwtService.verifyAsync<FacebookStatePayload>(
        stateJwt,
        { secret: this.OAUTH_STATE_JWT_SECRET },
      );

      if (payload.purpose !== 'facebook_page_connection_state') {
        this.logger.warn(`State JWT has invalid purpose: ${payload.purpose}`);
        return {};
      }

      return {
        successRedirectUrl: payload.successRedirectUrl,
        errorRedirectUrl: payload.errorRedirectUrl,
      };
    } catch (error) {
      this.logger.error(
        'Failed to verify or decode state JWT',
        (error as any).message,
      );
      return {};
    }
  }

  async handleFacebookCallback(
    code: string,
    receivedStateJwt: string,
  ): Promise<string | null> {
    try {
      const statePayload = await this._verifyState(receivedStateJwt);
      const internalUserId = statePayload.sub;
      const { longLivedUserToken, tokenExpiresAt } =
        await this._exchangeCodeForTokens(code);

      const facebookAccount = await this._upsertFacebookAccount(
        internalUserId,
        longLivedUserToken,
        tokenExpiresAt,
      );

      const pagesFromApi = await this._fetchFacebookPages(longLivedUserToken);

      await this.platformService.synchronizePlatforms({
        userId: internalUserId,
        platformName: SharePlatform.FACEBOOK,
        pagesFromApi: pagesFromApi,
        facebookAccountId: facebookAccount.id,
      });

      return statePayload.successRedirectUrl || null;
    } catch (error) {
      this.logger.error(
        `Facebook callback processing failed: ${(error as any).message}`,
        (error as any).stack,
      );
      throw error;
    }
  }

  private async _verifyState(
    receivedStateJwt: string,
  ): Promise<FacebookStatePayload> {
    try {
      const payload = await this.jwtService.verifyAsync<FacebookStatePayload>(
        receivedStateJwt,
        { secret: this.OAUTH_STATE_JWT_SECRET },
      );
      if (payload.purpose !== 'facebook_page_connection_state') {
        throw new Error('Invalid state JWT purpose.');
      }
      this.logger.log(
        `Valid OAuth state JWT received for user ID: ${payload.sub}`,
      );
      return payload;
    } catch (error) {
      this.logger.warn(
        `Invalid or expired OAuth state JWT: ${(error as any).message}`,
      );
      throw new UnauthorizedException(
        'Invalid OAuth state. CSRF attempt or expired session.',
      );
    }
  }

  private async _exchangeCodeForTokens(
    code: string,
  ): Promise<{ longLivedUserToken: string; tokenExpiresAt: Date | null }> {
    const tokenUrl = `https://graph.facebook.com/${this.API_VERSION}/oauth/access_token`;

    const tokenParams = {
      client_id: this.FB_APP_ID,
      redirect_uri: this.FB_REDIRECT_URI,
      client_secret: this.FB_APP_SECRET,
      code,
    };
    const response = await firstValueFrom(
      this.httpService.get<FacebookUserTokenResponse>(tokenUrl, {
        params: tokenParams,
      }),
    ).catch((error) => {
      this.logger.error(
        `Error exchanging code for user token:`,
        (error as any).response?.data || (error as any).message,
      );
      throw new InternalServerErrorException(
        'Failed to get user token from Facebook.',
      );
    });
    const shortLivedToken = response.data.access_token;

    const longLivedParams = {
      grant_type: 'fb_exchange_token',
      client_id: this.FB_APP_ID,
      client_secret: this.FB_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    };

    const longLivedResponse = await firstValueFrom(
      this.httpService.get<FacebookUserTokenResponse>(tokenUrl, {
        params: longLivedParams,
      }),
    ).catch((error) => {
      this.logger.error(
        'Error exchanging for long-lived user token:',
        (error as any).response?.data || (error as any).message,
      );
      return null;
    });

    if (!longLivedResponse) {
      return { longLivedUserToken: shortLivedToken, tokenExpiresAt: null };
    }

    const { access_token, expires_in } = longLivedResponse.data;
    let tokenExpiresAt: Date | null = null;
    if (expires_in) {
      tokenExpiresAt = new Date();
      tokenExpiresAt.setSeconds(tokenExpiresAt.getSeconds() + expires_in);
    }

    return { longLivedUserToken: access_token, tokenExpiresAt };
  }

  private async _upsertFacebookAccount(
    internalUserId: string,
    longLivedUserToken: string,
    tokenExpiresAt: Date | null,
  ): Promise<FacebookAccount> {
    const userProfileUrl = `https://graph.facebook.com/${this.API_VERSION}/me`;
    const userProfileParams = {
      fields: 'id,name,picture.type(large)',
      access_token: longLivedUserToken,
    };
    const userProfileResponse = await firstValueFrom(
      this.httpService.get(userProfileUrl, { params: userProfileParams }),
    );

    const {
      id: fbUserId,
      name: fbUserName,
      picture,
    } = userProfileResponse.data;
    const fbUserAvatarUrl = picture?.data?.url;

    if (!fbUserId) {
      throw new InternalServerErrorException(
        'Could not retrieve Facebook User ID from profile.',
      );
    }

    const facebookAccount = await this.prisma.facebookAccount.upsert({
      where: { facebook_user_id: fbUserId },
      create: {
        user_id: internalUserId,
        facebook_user_id: fbUserId,
        name: fbUserName,
        picture_url: fbUserAvatarUrl,
        long_lived_user_access_token: longLivedUserToken,
        token_expires_at: tokenExpiresAt,
      },
      update: {
        name: fbUserName,
        picture_url: fbUserAvatarUrl,
        long_lived_user_access_token: longLivedUserToken,
        token_expires_at: tokenExpiresAt,
        user_id: internalUserId,
      },
    });

    this.logger.log(
      `Upserted Facebook Account for ${fbUserName} (ID: ${facebookAccount.id})`,
    );
    return facebookAccount;
  }

  private async _fetchFacebookPages(
    userAccessToken: string,
  ): Promise<ApiPageData[]> {
    const pagesUrl = `https://graph.facebook.com/${this.API_VERSION}/me/accounts`;
    const pagesParams = {
      access_token: userAccessToken,
      fields: 'id,name,access_token,category,picture.type(large)',
    };

    const response = await firstValueFrom(
      this.httpService.get<FacebookPagesApiResponse>(pagesUrl, {
        params: pagesParams,
      }),
    );
    const pages = response.data.data || [];

    this.logger.log(`User authorized ${pages.length} page(s) via Facebook UI.`);

    const formattedPages: ApiPageData[] = pages.map((apiPage) => {
      return {
        id: apiPage.id,
        name: apiPage.name,
        access_token: apiPage.access_token,
        category: apiPage.category,
        picture_url: apiPage.picture?.data?.url,
        token_expires_at: null,
      };
    });

    return formattedPages;
  }
}
