import { MediaType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
  IsNotEmpty,
  IsInt,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true }) // Ensures each item in the array is validated
  @Type(() => MediaDto) // Tells class-validator to use `MediaDto` for validation
  medias_data: MediaDto[];

  @IsArray()
  @IsInt({ each: true })
  cate_ids: number[];
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional() // Now optional to allow updates without changing categories
  @IsArray()
  @IsInt({ each: true })
  cate_ids?: number[];

  @IsOptional() // Ensures media is updated only if provided
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaDto)
  medias_data?: MediaDto[];
}

export class MediaDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsEnum(MediaType)
  media_type: MediaType;
}
