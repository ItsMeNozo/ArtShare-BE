import { PlatformStatus } from 'src/generated';
import { ApiPageData } from 'src/platform/dtos/sync-platform-input.dto';

export interface PublicFacebookPageData {
  id: string;
  name: string;
  category: string;
  platformDbId: number;
  status: PlatformStatus;
}
interface FacebookPagePictureData {
  data: {
    url: string;
  };
}

export interface FacebookPageApiResponseData {
  id: string;
  name: string;
  access_token: string;
  category: string;
  tasks?: string[];
  picture?: FacebookPagePictureData;
}

export interface FacebookPagesApiResponse {
  data: FacebookPageApiResponseData[];
  paging: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

export interface FacebookUserTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface FacebookStatePayload {
  sub: string;
  nonce: string;
  purpose: 'facebook_page_connection_state';
  successRedirectUrl: string;
  errorRedirectUrl: string;
}

export interface ProcessedFacebookCallbackData {
  userId: string;
  facebookAccountId: number;
  pagesFromApi: ApiPageData[];
  successRedirectUrl: string | null;
  errorRedirectUrl: string | null;
}
