import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { MediaType } from 'src/generated';

export class GetPresignedUrlRequestDto {
  @IsString()
  @IsOptional()
  fileName: string = '';

  @IsString()
  @Matches(/^(png|jpg|jpeg|gif|webp|mp4|mov|avi)$/i, {
    message: 'Invalid file extension',
  })
  extension: string;

  @IsEnum(MediaType, {
    message: 'Invalid media type. Allowed values: image, video',
  })
  mediaType: MediaType;

  @IsOptional()
  @IsString()
  directory?: string = 'uncategorized';
}
