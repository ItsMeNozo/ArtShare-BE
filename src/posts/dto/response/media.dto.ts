import { Expose } from 'class-transformer';
import { MediaType } from 'src/generated';

export class MediaResponseDto {
  @Expose() id: number;
  media_type: MediaType;
  description?: string;
  url: string;
  creator_id: string;
  downloads: number;
  created_at: Date;
}
