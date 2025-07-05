import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SharePlatform } from 'src/generated';

export class PlatformConfigInput {
  @IsNotEmpty()
  @IsString()
  pageName: string;

  @IsNotEmpty()
  @IsString()
  accessToken: string;

  @IsString()
  @IsOptional()
  category?: string;
}

export class CreatePlatformDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsEnum(SharePlatform)
  @IsNotEmpty()
  name: SharePlatform;

  @IsNotEmpty()
  @IsString()
  externalPageId: string;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => PlatformConfigInput)
  config: PlatformConfigInput;
}
