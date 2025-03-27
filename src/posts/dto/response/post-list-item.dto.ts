import { Exclude } from 'class-transformer';
import { MediaResponseDto } from './media.dto';
import { UserResponseDto } from './user.dto';
import { CategoryResponseDto } from './category.dto';

export class PostListItemResponseDto {
  id: number;
  user_id: string;
  title: string;
  description?: string;
  thumbnail_url: string;
  is_published: boolean;
  is_private: boolean;
  like_count: number;
  share_count: number;
  comment_count: number;
  created_at: Date;

  @Exclude() medias: MediaResponseDto[];

  @Exclude() user: UserResponseDto;

  @Exclude() categories: CategoryResponseDto[];
}
