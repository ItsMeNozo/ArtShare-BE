import { AutoProjectStatus, SharePlatform } from 'src/generated';

class PlatformInfo {
  id: number;
  name: SharePlatform;
}

export class AutoProjectListItemDto {
  id: number;
  title: string;
  status: AutoProjectStatus;
  platform: PlatformInfo;
  postCount: number;
  nextPostAt: Date | null;
  created_at: Date;
  updated_at: Date | null;
}
