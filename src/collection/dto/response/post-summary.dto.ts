export class PostSummaryDto {
  id: number;
  title: string;
  thumbnailUrl?: string;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  viewCount: number;
}
