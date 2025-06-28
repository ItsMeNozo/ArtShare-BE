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

  external_page_id: string;
  token_expires_at: Date | null;
  status: PlatformStatus;
}

export class AutoProjectDetailsDto {
  id: number;
  title: string;
  description: string;
  status: AutoProjectStatus;
  created_at: Date;
  updated_at: Date | null;
  platform: PlatformDto;
}
