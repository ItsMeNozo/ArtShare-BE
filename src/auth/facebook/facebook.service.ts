import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { FacebookAccount } from 'src/generated';
import { ApiPageData } from 'src/platform/dtos/sync-platform-input.dto';
import { PrismaService } from 'src/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import {
  FacebookPagesApiResponse,
  FacebookStatePayload,
  FacebookUserTokenResponse,
  ProcessedFacebookCallbackData,
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
    private readonly prisma: PrismaService,
  ) {
    this.FB_APP_ID = this.configService.get<string>('FACEBOOK_APP_ID');
    this.FB_APP_SECRET = this.configService.get<string>('FACEBOOK_APP_SECRET');
    const callbackBaseUrl =
      this.configService.get<string>('FACEBOOK_CALLBACK_URL_BASE') ||
      'http://localhost:3000';
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
      'user_posts',
      'user_photos',
      'user_videos',
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

  async processOauthCallback(
    code: string,
    receivedStateJwt: string,
  ): Promise<ProcessedFacebookCallbackData> {
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

      return {
        userId: internalUserId,
        facebookAccountId: facebookAccount.id,
        pagesFromApi: pagesFromApi,
        successRedirectUrl: statePayload.successRedirectUrl || null,
        errorRedirectUrl: statePayload.errorRedirectUrl || null,
      };
    } catch (error) {
      this.logger.error(
        `Facebook callback processing failed: ${(error as any).message}`,
        (error as any).stack,
      );

      throw error;
    }
  }

  async getPostContentFromUrl(
    internalUserId: string,
    postUrl: string,
  ): Promise<string> {
    this.logger.log(`Processing URL for user ${internalUserId}: ${postUrl}`);

    let effectiveUrl = postUrl;
    if (postUrl.includes('fb.watch') || postUrl.includes('/share/')) {
      effectiveUrl = await this._resolveRedirectUrl(postUrl);
    }

    const facebookAccount = await this.prisma.facebookAccount.findFirst({
      where: { userId: internalUserId },
    });

    if (!facebookAccount?.longLivedUserAccessToken) {
      throw new UnauthorizedException(
        'User has not connected a Facebook account or the token is missing.',
      );
    }
    const userAccessToken = facebookAccount.longLivedUserAccessToken;

    const idParts = this._getPostIdFromUrl(effectiveUrl);
    if (!idParts?.postId) {
      throw new Error('Could not parse a valid Post ID from the URL.');
    }

    if (idParts.pageId) {
      const finalPostId = `${idParts.pageId}_${idParts.postId}`;
      this.logger.log(`Using combined ID for direct API call: ${finalPostId}`);

      const fields = 'message,name,description,story';
      try {
        const contentUrl = `https://graph.facebook.com/${this.API_VERSION}/${finalPostId}`;
        const contentParams = { fields, access_token: userAccessToken };
        const contentResponse = await firstValueFrom(
          this.httpService.get<{ [key: string]: any }>(contentUrl, {
            params: contentParams,
          }),
        );
        const content =
          contentResponse.data.message ||
          contentResponse.data.name ||
          contentResponse.data.description ||
          contentResponse.data.story;
        if (content) return content;
        return '';
      } catch (error) {
        return this._handleApiError(error, finalPostId);
      }
    } else {
      this.logger.log(
        `Only Post ID found. Using two-step metadata process for ID: ${idParts.postId}`,
      );

      let objectType: string;
      try {
        const metadataUrl = `https://graph.facebook.com/${this.API_VERSION}/${idParts.postId}`;
        const metadataParams = { metadata: 1, access_token: userAccessToken };
        const metadataResponse = await firstValueFrom(
          this.httpService.get<{ metadata: { type: string } }>(metadataUrl, {
            params: metadataParams,
          }),
        );
        objectType = metadataResponse.data.metadata.type;
        this.logger.log(`Detected Facebook object type: '${objectType}'`);
      } catch (error) {
        return this._handleApiError(error, idParts.postId);
      }

      let textFields: string;
      switch (objectType) {
        case 'photo':
          textFields = 'name';
          break;
        case 'video':
        case 'reel':
          textFields = 'message,description';
          break;
        case 'status':
        case 'link':
        case 'post':
          textFields = 'message';
          break;
        default:
          this.logger.warn(
            `Unsupported Facebook object type via metadata: '${objectType}'`,
          );
          return '';
      }

      try {
        const contentUrl = `https://graph.facebook.com/${this.API_VERSION}/${idParts.postId}`;
        const contentParams = {
          fields: textFields,
          access_token: userAccessToken,
        };
        const contentResponse = await firstValueFrom(
          this.httpService.get<{ [key: string]: any }>(contentUrl, {
            params: contentParams,
          }),
        );
        const content =
          contentResponse.data.message ||
          contentResponse.data.description ||
          contentResponse.data.name;
        if (content) return content;
        return '';
      } catch (error) {
        return this._handleApiError(error, idParts.postId);
      }
    }
  }

  private _handleApiError(error: any, objectId: string): never {
    const apiError = error.response?.data?.error;
    const apiErrorMessage = apiError?.message;
    const apiErrorCode = apiError?.code;

    this.logger.error(
      `Failed to fetch content for ID ${objectId}. API Error:`,
      apiError,
    );

    if (apiErrorCode === 10) {
      throw new BadRequestException(
        'This content cannot be accessed. It may be due to copyright or privacy settings on the original post.',
      );
    }
    if (apiErrorCode === 12) {
      throw new BadRequestException(
        'This post is in a format that is no longer supported by the Facebook API.',
      );
    }
    if (
      apiErrorCode === 100 &&
      apiErrorMessage?.includes('nonexisting field')
    ) {
      this.logger.error(
        `Logic error: An incorrect field was requested for object ID ${objectId}.`,
      );
      throw new InternalServerErrorException(
        'There was an unexpected error retrieving the post content.',
      );
    }

    throw new InternalServerErrorException(
      `Failed to fetch content from Facebook. API Error: "${apiErrorMessage || 'The post may be private, deleted, or the URL format is not supported.'}"`,
    );
  }

  private _getPostIdFromUrl(
    url: string,
  ): { postId: string; pageId?: string } | null {
    const regex =
      /(?:posts|videos|reel|photo(?:s|\.php)|share\/p)\/([a-zA-Z0-9_.-]+)|(?:story_fbid|fbid)=([a-zA-Z0-9_.-]+)|watch\/\?v=([0-9]+)/;
    const pageIdRegex = /[?&]id=([0-9]+)/;

    const postMatches = url.match(regex);
    const pageMatches = url.match(pageIdRegex);

    if (postMatches) {
      const postId = postMatches[1] || postMatches[2] || postMatches[3];
      const pageId = pageMatches ? pageMatches[1] : undefined;

      this.logger.log(`Parsed IDs: postId=${postId}, pageId=${pageId}`);
      return { postId, pageId };
    }

    this.logger.warn(`Could not parse a known Post ID format from URL: ${url}`);
    return null;
  }

  private async _resolveRedirectUrl(url: string): Promise<string> {
    try {
      this.logger.log(`Resolving redirect for short URL: ${url}`);

      const response = await firstValueFrom(
        this.httpService.head(url, { maxRedirects: 5 }),
      );

      const finalUrl = response.request.res.responseUrl;
      if (!finalUrl || finalUrl === url) {
        throw new Error(
          'Could not resolve the short URL to a final destination.',
        );
      }

      this.logger.log(`Resolved short URL to: ${finalUrl}`);
      return finalUrl;
    } catch (error: any) {
      this.logger.error(`Failed to resolve redirect for ${url}`, error.stack);
      throw new Error(
        `The link ${url} could not be resolved. It may be broken or private.`,
      );
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
      fields: 'id,name',
      access_token: longLivedUserToken,
    };
    const userProfileResponse = await firstValueFrom(
      this.httpService.get(userProfileUrl, { params: userProfileParams }),
    );

    const { id: fbUserId, name: fbUserName } = userProfileResponse.data;

    if (!fbUserId) {
      throw new InternalServerErrorException(
        'Could not retrieve Facebook User ID from profile.',
      );
    }

    const facebookAccount = await this.prisma.facebookAccount.upsert({
      where: { facebookUserId: fbUserId },
      create: {
        userId: internalUserId,
        facebookUserId: fbUserId,
        name: fbUserName,
        longLivedUserAccessToken: longLivedUserToken,
        tokenExpiresAt: tokenExpiresAt,
      },
      update: {
        name: fbUserName,
        longLivedUserAccessToken: longLivedUserToken,
        tokenExpiresAt: tokenExpiresAt,
        userId: internalUserId,
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
      fields: 'id,name,access_token,category',
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
        accessToken: apiPage.access_token,
        category: apiPage.category,
        tokenExpiresAt: null,
      };
    });

    return formattedPages;
  }
}
