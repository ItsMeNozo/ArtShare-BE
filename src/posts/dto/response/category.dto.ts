import { Expose } from 'class-transformer';
import { CategoryType } from 'src/generated';

export class PostCategoryResponseDto {
  @Expose()
  id: number;
  @Expose()
  name: string;
  @Expose()
  type: CategoryType;
}
