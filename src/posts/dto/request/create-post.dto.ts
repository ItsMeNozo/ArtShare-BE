import { Transform } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  video_url?: string;

  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => JSON.parse(value), { toClassOnly: true })
  cate_ids: number[];
}
