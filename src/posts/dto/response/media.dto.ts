import { Expose } from 'class-transformer';
import { MediaType } from 'src/generated';

export class MediaResponseDto {
  @Expose() id: number;
  mediaType: MediaType;
  description?: string;
  url: string;
  creatorId: string;
  downloads: number;
  createdAt: Date;
}
