import { IsEnum } from 'class-validator';
import { SharePlatform } from 'src/generated';

export class ShareDetailsDto {
  id: number;
  userId: string;
  postId?: number;
  blogId?: number;

  @IsEnum(SharePlatform)
  sharePlatform: SharePlatform;

  createdAt: Date;
}
