import { Exclude } from 'class-transformer';
import { PostCategoryResponseDto } from './category.dto';
import { MediaResponseDto } from './media.dto';
import { UserResponseDto } from './user.dto';

export class PostListItemResponse {
  id: number;
  userId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  isPublished: boolean;
  isPrivate: boolean;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  createdAt: Date;

  medias: MediaResponseDto[];

  user: UserResponseDto;

  @Exclude() categories: PostCategoryResponseDto[];

  isLikedByCurrentUser: boolean;
}
