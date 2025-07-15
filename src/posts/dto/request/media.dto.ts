import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { MediaType } from 'src/generated';

export class MediaDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsEnum(MediaType)
  mediaType: MediaType;
}
