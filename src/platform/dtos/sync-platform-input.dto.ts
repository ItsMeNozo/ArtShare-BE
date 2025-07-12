import { IsEnum } from 'class-validator';
import { SharePlatform } from 'src/generated';

export interface ApiPageData {
  id: string;
  name: string;
  accessToken: string;
  category: string;
  tokenExpiresAt: Date | null;
  pictureUrl?: string;
  [key: string]: any;
}

export class SyncPlatformInputDto {
  userId: string;

  @IsEnum(SharePlatform)
  platformName: SharePlatform;

  pagesFromApi: ApiPageData[];
  facebookAccountId: number;
}
