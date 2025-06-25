import { CategoryType } from '../request/create-category.dto';

export class CategoryResponseDto {
  id: number;
  name: string;
  description: string;
  example_images: string[];
  type: CategoryType;
  created_at: Date;
  updated_at: Date;
  posts_count?: number; // Optional field for admin users
}
