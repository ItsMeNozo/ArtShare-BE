import { IsEnum } from 'class-validator';
import { SharePlatform } from 'src/generated';

export class ShareDetailsDto {
  id: number;
  user_id: string;
  post_id?: number;
  blog_id?: number;

  @IsEnum(SharePlatform)
  share_platform: SharePlatform;

  created_at: Date;
}
