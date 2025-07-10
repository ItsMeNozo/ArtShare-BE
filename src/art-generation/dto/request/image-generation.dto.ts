import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { AspectRatio } from 'src/art-generation/enum/aspect-ratio';
import { ModelKey } from 'src/art-generation/image-generator.interface';

export class ImageGenerationDto {
  @IsEnum(ModelKey)
  @IsNotEmpty()
  modelKey: ModelKey;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsNumber()
  @IsNotEmpty()
  n: number;

  @IsEnum(AspectRatio)
  @IsNotEmpty()
  aspectRatio: AspectRatio;

  @IsString()
  @IsOptional()
  style?: string;

  @IsString()
  @IsOptional()
  lighting?: string;

  @IsString()
  @IsOptional()
  camera?: string;
}
