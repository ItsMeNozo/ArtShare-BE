import { CategoryType } from '../request/create-category.dto';

export class CategoryResponseDto {
  id: number;
  name: string;
  description: string;
  exampleImages: string[];
  type: CategoryType;
  createdAt: Date;
  updatedAt: Date;
  postsCount?: number; // Optional field for admin users
}
