import { BlogUserInfoResponseDto } from './blog-user-info.dto';

export class BlogDetailsResponseDto {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date | null;
  isPublished: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  user: BlogUserInfoResponseDto;
  pictures: string[];
  embeddedVideos: string[];
  isLikedByCurrentUser: boolean;
}
