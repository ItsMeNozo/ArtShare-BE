import { PostCategoryResponseDto } from './category.dto';

export class GeneratePostMetadataResponseDto {
  title: string;
  description: string;
  categories: PostCategoryResponseDto[];
}
