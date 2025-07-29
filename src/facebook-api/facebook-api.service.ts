import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { PublicFacebookPageData } from 'src/auth/facebook/facebook.type';
import { SharePlatform } from 'src/generated';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class FacebookApiService {
  private readonly logger = new Logger(FacebookApiService.name);
  private readonly API_VERSION = 'v22.0';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async getFacebookAccountInfo(userId: string): Promise<
    Array<{
      name: string;
      pictureUrl: string | null;
      platforms: PublicFacebookPageData[];
    }>
  > {
    const accounts = await this.prisma.facebookAccount.findMany({
      where: { userId: userId },
      include: {
        platforms: {
          where: { name: SharePlatform.FACEBOOK },
          select: {
            id: true,
            externalPageId: true,
            status: true,
            config: true,
          },
        },
      },
    });

    return Promise.all(
      accounts.map(async (account) => {
        const formattedPlatforms: PublicFacebookPageData[] =
          account.platforms.map((p) => ({
            platformDbId: p.id,
            id: p.externalPageId,
            name: (p.config as any)?.pageName || 'Unknown Page',
            category: (p.config as any)?.category || 'Unknown Category',
            status: p.status,
          }));

        const freshPictureUrl = await this._getFreshUserProfilePicture(
          account.longLivedUserAccessToken,
        );

        return {
          name: account.name,
          pictureUrl: freshPictureUrl,
          platforms: formattedPlatforms,
        };
      }),
    );
  }

  async getFreshFacebookPagePictureUrl(
    pageId: string,
    pageAccessToken: string,
  ): Promise<string | null> {
    const url = `https://graph.facebook.com/${this.API_VERSION}/${pageId}/picture`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            redirect: false,
            type: 'large',
            access_token: pageAccessToken,
          },
        }),
      );
      return response.data.data.url;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch fresh picture for page ${pageId}`,
        error.response?.data,
      );
      return null;
    }
  }

  private async _getFreshUserProfilePicture(
    userAccessToken: string,
  ): Promise<string | null> {
    const url = `https://graph.facebook.com/${this.API_VERSION}/me/picture`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            access_token: userAccessToken,
            redirect: false,
            type: 'large',
          },
        }),
      );
      return response.data.data.url;
    } catch (error) {
      this.logger.error(
        `Failed to fetch fresh user profile picture: ${(error as any).message}`,
      );
      return null;
    }
  }
}
