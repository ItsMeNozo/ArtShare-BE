import { PostSummaryDto } from './post-summary.dto';

export class CollectionDto {
  id: number;
  name: string;
  isPrivate: boolean;
  thumbnailUrl?: string;
  description?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date | null;
  posts: PostSummaryDto[];
}
