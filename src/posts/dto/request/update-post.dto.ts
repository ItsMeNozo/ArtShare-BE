import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ obj, key }) => {
    const value = obj[key];
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return value;
  })
  isMature?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ obj, key }) => {
    const value = obj[key];
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return value;
  })
  aiCreated?: boolean;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  @Transform(
    ({ value }) => {
      if (!value) return [];
      try {
        return typeof value === 'string'
          ? JSON.parse(value).map((v: any) => Number(v))
          : Array.isArray(value)
            ? value.map(Number)
            : [];
      } catch {
        return [];
      }
    },
    { toClassOnly: true },
  )
  categoryIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(
    ({ value }) => {
      if (!value) return [];
      try {
        return typeof value === 'string'
          ? JSON.parse(value)
          : Array.isArray(value)
            ? value
            : [];
      } catch {
        return [];
      }
    },
    { toClassOnly: true },
  )
  existingImageUrls?: string[];

  @IsString()
  thumbnailCropMeta: string = '{}';
}
