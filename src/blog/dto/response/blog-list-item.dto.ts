import { BlogUserInfoResponseDto } from './blog-user-info.dto';

export class BlogListItemResponseDto {
  id: number;
  title: string;
  created_at: Date;
  like_count: number;
  comment_count: number;
  share_count: number;
  user: BlogUserInfoResponseDto; 
  is_published: boolean;
}
