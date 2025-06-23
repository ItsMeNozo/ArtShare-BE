import {
  AutoProjectStatus,
  PlatformStatus,
  SharePlatform,
} from 'src/generated';

export class AutoProjectDetailsDto {
  id: number;
  title: string;
  description: string;
  status: AutoProjectStatus;
  created_at: Date;
  updated_at: Date | null;
  platform: {
    id: number;
    name: SharePlatform;
    external_page_id: string;
    token_expires_at: Date | null;
    status: PlatformStatus;
  };
}
