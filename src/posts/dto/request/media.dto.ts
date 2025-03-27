import { MediaType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class MediaDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsEnum(MediaType)
  media_type: MediaType;
}
