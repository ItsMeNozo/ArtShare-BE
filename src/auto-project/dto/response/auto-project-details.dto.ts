import { IsEnum } from 'class-validator';
import {
  AutoProjectStatus,
  PlatformStatus,
  SharePlatform,
} from 'src/generated';

export class PlatformDto {
  id: number;

  @IsEnum(SharePlatform)
  name: SharePlatform;

  externalPageId: string;
  tokenExpiresAt: Date | null;
  status: PlatformStatus;
}

export class AutoProjectDetailsDto {
  id: number;
  title: string;
  description: string | null;
  status: AutoProjectStatus;
  createdAt: Date;
  updatedAt: Date | null;
  platform: PlatformDto;
}
