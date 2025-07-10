import { AutoPostStatus } from 'src/auto-post/enum/auto-post-status.enum';

export class AutoPostDetailsDto {
  id: number;
  content: string;
  imageUrls: string[];
  scheduledAt: Date | null;
  status: AutoPostStatus;
  createdAt: Date;
  updatedAt: Date | null;
}
