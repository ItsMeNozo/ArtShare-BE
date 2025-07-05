import { Type } from 'class-transformer';
import { MediaResponseDto } from './media.dto';
import { UserResponseDto } from './user.dto';
import { PostCategoryResponseDto } from './category.dto';

export class PostDetailsResponseDto {
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

  @Type(() => MediaResponseDto)
  medias: MediaResponseDto[];

  @Type(() => UserResponseDto)
  user: UserResponseDto;

  @Type(() => PostCategoryResponseDto)
  categories: PostCategoryResponseDto[];
}
