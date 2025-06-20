// src/auto-project/dto/create-auto-project.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AutoPostMeta } from './auto-post-meta.dto';

export class CreateAutoProjectDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsInt()
  @IsNotEmpty()
  platform_id: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutoPostMeta)
  @IsOptional()
  auto_post_meta_list?: AutoPostMeta[];

  // @IsBoolean()
  // is_draft: boolean;
}
