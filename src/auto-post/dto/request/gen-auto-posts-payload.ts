import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

export class GenAutoPostsPayload {
  @IsNumber()
  autoProjectId: number;

  @IsString()
  @MinLength(10)
  contentPrompt: string;

  @IsNumber()
  @Min(1)
  postCount: number;

  @IsString()
  @IsOptional()
  toneOfVoice?: string;

  @IsNumber()
  @IsOptional()
  wordCount?: number;

  @IsOptional()
  @IsBoolean()
  generateHashtag?: boolean;

  @IsOptional()
  @IsBoolean()
  includeEmojis?: boolean;

  @IsOptional()
  @IsUrl()
  url?: string;
}
