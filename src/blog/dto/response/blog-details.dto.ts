import { BlogUserInfoResponseDto } from './blog-user-info.dto';

export class BlogDetailsResponseDto {
  id: number;
  title: string;
  content: string; 
  created_at: Date;
  updated_at?: Date | null;
  is_published: boolean;
  like_count: number;
  comment_count: number;
  share_count: number;
  user: BlogUserInfoResponseDto; 
}
