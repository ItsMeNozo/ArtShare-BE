import { IsEnum, IsInt } from 'class-validator';
import { TargetType, SharePlatform } from '@prisma/client';

export class CreateShareDto {
  @IsInt()
  target_id: number;

  @IsEnum(TargetType)
  target_type: TargetType; // e.g., POST or BLOG

  @IsEnum(SharePlatform)
  share_platform: SharePlatform; // e.g., FACEBOOK, TWITTER, etc.
}
