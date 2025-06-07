import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import {
  FacebookPageApiResponseData,
  FacebookPagesApiResponse,
  FacebookUserTokenResponse,
  PublicFacebookPageData,
} from './facebook.type';
import { SharePlatform } from '@prisma/client';
import { PublicPlatformOutputDto } from 'src/platform/dtos/public-platform-output.dto';
import { ApiPageData } from 'src/platform/dtos/sync-platform-input.dto';
import { PlatformService } from 'src/platform/platform.service';

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

  async getFacebookLoginUrl(userId: string): Promise<{ loginUrl: string }> {
    const payload = {
      sub: userId,
      nonce: uuidv4(),
      purpose: 'facebook_page_connection_state',
    };
    const stateJwt = await this.jwtService.signAsync(payload, {
      secret: this.OAUTH_STATE_JWT_SECRET,
      expiresIn: '10m',
    });

    const scopes = ['pages_show_list', 'pages_manage_posts'].join(',');
    const loginUrl = `https://www.facebook.com/${this.API_VERSION}/dialog/oauth?client_id=${this.FB_APP_ID}&redirect_uri=${encodeURIComponent(this.FB_REDIRECT_URI)}&state=${stateJwt}&scope=${scopes}&response_type=code`;

    this.logger.log(`Generated Facebook login URL for user ${userId}.`);
    return { loginUrl };
  }

  async handleFacebookCallback(
    code: string,
    receivedStateJwt: string,
  ): Promise<PublicFacebookPageData[]> {
    let statePayload: { sub: string; purpose: string };
    try {
      statePayload = await this.jwtService.verifyAsync(receivedStateJwt, {
        secret: this.OAUTH_STATE_JWT_SECRET,
      });
      if (statePayload.purpose !== 'facebook_page_connection_state') {
        throw new Error('Invalid state JWT purpose.');
      }
      this.logger.log(
        `Valid OAuth state JWT received for user ID: ${statePayload.sub}`,
      );
    } catch (error) {
      this.logger.warn(
        '[Request ID: ${requestId}] Invalid or expired OAuth state JWT for Facebook callback:',
        (error as any).message,
      );
      throw new UnauthorizedException(
        'Invalid OAuth state. CSRF attempt or expired session.',
      );
    }

    const internalUserId = statePayload.sub;

    const tokenUrl = `https://graph.facebook.com/${this.API_VERSION}/oauth/access_token`;
    const tokenParams = {
      client_id: this.FB_APP_ID,
      redirect_uri: this.FB_REDIRECT_URI,
      client_secret: this.FB_APP_SECRET,
      code,
    };
    let userTokenResponse: FacebookUserTokenResponse;
    try {
      const response = await firstValueFrom(
        this.httpService.get<FacebookUserTokenResponse>(tokenUrl, {
          params: tokenParams,
        }),
      );
      userTokenResponse = response.data;
    } catch (error) {
      this.logger.error(
        `Error exchanging code for user token:`,
        (error as any).response?.data || (error as any).message,
      );
      throw new InternalServerErrorException(
        'Failed to get user token from Facebook.',
      );
    }

    const longLivedTokenUrl = `https://graph.facebook.com/${this.API_VERSION}/oauth/access_token`;
    const longLivedParams = {
      grant_type: 'fb_exchange_token',
      client_id: this.FB_APP_ID,
      client_secret: this.FB_APP_SECRET,
      fb_exchange_token: userTokenResponse.access_token,
    };
    let longLivedUserToken: string;
    try {
      const response = await firstValueFrom(
        this.httpService.get<FacebookUserTokenResponse>(longLivedTokenUrl, {
          params: longLivedParams,
        }),
      );
      longLivedUserToken = response.data.access_token;
    } catch (error) {
      this.logger.error(
        'Error exchanging for long-lived user token:',
        (error as any).response?.data || (error as any).message,
      );
      longLivedUserToken = userTokenResponse.access_token;
    }

    const pagesUrl = `https://graph.facebook.com/${this.API_VERSION}/me/accounts`;
    const pagesParams = {
      access_token: longLivedUserToken,
      fields: 'id,name,access_token,category,tasks',
    };

    let authorizedPagesFromApi: FacebookPageApiResponseData[];
    try {
      const response = await firstValueFrom(
        this.httpService.get<FacebookPagesApiResponse>(pagesUrl, {
          params: pagesParams,
        }),
      );
      authorizedPagesFromApi = response.data.data || [];
    } catch (error) {
      this.logger.error(
        `Error fetching user's authorized pages for user_id ${internalUserId}:`,
        (error as any).response?.data || (error as any).message,
      );
      throw new InternalServerErrorException(
        'Failed to fetch authorized Facebook pages.',
      );
    }

    this.logger.log(
      `User ${internalUserId} authorized ${authorizedPagesFromApi.length} page(s) via Facebook UI.`,
    );

    const pagesToSync: ApiPageData[] = authorizedPagesFromApi.map(
      (apiPage) => ({
        id: apiPage.id,
        name: apiPage.name,
        access_token: apiPage.access_token,
        category: apiPage.category,
      }),
    );

    const synchronizedPlatforms: PublicPlatformOutputDto[] =
      await this.platformService.synchronizePlatforms({
        userId: internalUserId,
        platformName: SharePlatform.FACEBOOK,
        pagesFromApi: pagesToSync,
      });

    const publicFacebookPages: PublicFacebookPageData[] =
      synchronizedPlatforms.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        platform_db_id: p.platform_db_id,
      }));

    this.logger.log(
      `Successfully synchronized ${publicFacebookPages.length} Facebook page(s) for user_id ${internalUserId}.`,
    );
    return publicFacebookPages;
  }
}
