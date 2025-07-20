import { IsEnum, IsInt } from 'class-validator';
import { SharePlatform, TargetType } from 'src/generated';

export class CreateShareDto {
  @IsInt()
  targetId: number;

  @IsEnum(TargetType)
  targetType: TargetType; // e.g., POST or BLOG

  @IsEnum(SharePlatform)
  sharePlatform: SharePlatform;
}
