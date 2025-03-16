import { MediaType } from "@prisma/client";
import { IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class GetPresignedUrlRequestDto {
  @IsString()
  @IsOptional()
  fileName: string = "";

  @IsString()
  @Matches(/^(png|jpg|jpeg|gif|webp|mp4|mov|avi)$/i, {
    message: 'Invalid file extension',
  })
  extension: string;

  @IsIn(Object.values(MediaType), {
    message: 'Invalid media type. Allowed values: image, video',
  })
  mediaType: MediaType;

  @IsOptional()
  @IsString()
  directory?: string = 'uncategorized';
}