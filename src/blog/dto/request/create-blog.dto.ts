import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBlogDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean = false;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pictures?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  embeddedVideos?: string[];
}
