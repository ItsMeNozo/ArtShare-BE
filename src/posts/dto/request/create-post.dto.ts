import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePostRequestDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsString()
  @IsNotEmpty()
  thumbnailUrl: string;

  @IsBoolean()
  @Transform(({ obj, key }) => {
    const value = obj[key];
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return value;
  })
  isMature: boolean = false;

  @IsBoolean()
  @Transform(({ obj, key }) => {
    const value = obj[key];
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
    return value;
  })
  aiCreated: boolean = false;

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

  @IsString()
  thumbnailCropMeta: string = '{}';

  @IsInt()
  @IsOptional()
  promptId?: number;
}
