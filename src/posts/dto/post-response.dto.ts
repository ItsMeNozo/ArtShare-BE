import { MediaType } from '@prisma/client';
import { Exclude, Type } from 'class-transformer';

export class MediaResponseDto {
  @Exclude() id: number;
  media_type: MediaType;
  description?: string;
  url: string;
  creator_id: number;
  downloads: number;
  created_at: Date;
}

export class UserResponseDto {
  @Exclude() id: number;
  username: string;
  @Exclude() email: string;
  @Exclude() password_hash: string;
  full_name: string;
  profile_picture_url: string;
  @Exclude() bio: string;
  @Exclude() created_at: Date;
  @Exclude() updated_at: Date;
  @Exclude() refresh_token: string;
}

export class CategoryResponseDto {
  id: number;
  name: string;
  cate_name: string;
  url: string;
  created_at: Date;
}

export class PostDetailsResponseDto {
  id: number;
  @Exclude() user_id: number;
  title?: string;
  description?: string;
  is_published: boolean;
  is_private: boolean;
  like_count: number;
  share_count: number;
  comment_count: number;
  created_at: Date;

  @Type(() => MediaResponseDto)
  medias: MediaResponseDto[];

  @Type(() => UserResponseDto)
  user: UserResponseDto[];

  @Type(() => CategoryResponseDto)
  categories: CategoryResponseDto[];
}

export class CreatePostResponseDto extends PostDetailsResponseDto {}

export class UpdatePostResponseDto extends PostDetailsResponseDto {}
