import { Type } from 'class-transformer';
import { PostCategoryResponseDto } from './category.dto';
import { PostMediaDto } from './post-media.dto';

class PostAuthorDto {
  username: string;
  fullName: string;
  profilePictureUrl: string | null;
}

export class PostDetailForViewDto {
  id: number;
  userId: string;
  title: string;
  description: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  isMature: boolean;
  aiCreated: boolean;
  viewCount: number;
  medias: PostMediaDto[];
  user: PostAuthorDto;
  isLikedByCurrentUser: boolean;

  @Type(() => PostCategoryResponseDto)
  categories: PostCategoryResponseDto[];
}
