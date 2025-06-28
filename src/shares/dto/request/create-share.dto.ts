import { IsEnum, IsInt } from 'class-validator';
import { SharePlatform, TargetType } from 'src/generated';

export class CreateShareDto {
  @IsInt()
  target_id: number;

  @IsEnum(TargetType)
  target_type: TargetType; // e.g., POST or BLOG

  @IsEnum(SharePlatform)
  share_platform: SharePlatform;
}
