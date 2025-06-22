import { SharePlatform } from 'src/generated';

export interface ApiPageData {
  id: string;
  name: string;
  access_token: string;
  category: string;
  token_expires_at: Date | null;
  picture_url?: string;
  [key: string]: any;
}

export class SyncPlatformInputDto {
  userId: string;
  platformName: SharePlatform;
  pagesFromApi: ApiPageData[];
  facebookAccountId: number;
}
