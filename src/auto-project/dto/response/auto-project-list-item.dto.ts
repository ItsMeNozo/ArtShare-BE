import { IsEnum } from 'class-validator';
import { AutoProjectStatus, SharePlatform } from 'src/generated';

class PlatformInfo {
  id: number;

  @IsEnum(SharePlatform)
  name: SharePlatform;
}

export class AutoProjectListItemDto {
  id: number;
  title: string;
  status: AutoProjectStatus;
  platform: PlatformInfo;
  postCount: number;
  nextPostAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}
