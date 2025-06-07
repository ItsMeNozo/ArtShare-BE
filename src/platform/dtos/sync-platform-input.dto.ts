import { SharePlatform } from '@prisma/client';

export interface ApiPageData {
  id: string;
  name: string;
  access_token: string;
  category: string;
  token_expires_at: Date | null;
  [key: string]: any;
}

export class SyncPlatformInputDto {
  userId: string;
  platformName: SharePlatform;
  pagesFromApi: ApiPageData[];
}
