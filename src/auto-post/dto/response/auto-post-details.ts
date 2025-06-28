import { AutoPostStatus } from 'src/auto-post/enum/auto-post-status.enum';

export class AutoPostDetailsDto {
  id: number;
  content: string;
  image_urls: string[];
  scheduled_at: Date | null;
  status: AutoPostStatus;
  created_at: Date;
  updated_at: Date | null;
}
