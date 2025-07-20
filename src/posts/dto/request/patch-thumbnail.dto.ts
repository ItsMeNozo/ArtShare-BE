import { IsNumber, IsOptional } from 'class-validator';

export class PatchThumbnailDto {
  @IsNumber()
  cropX: number;

  @IsNumber()
  cropY: number;

  @IsNumber()
  cropW: number;

  @IsNumber()
  cropH: number;

  @IsNumber()
  zoom: number;

  @IsNumber()
  @IsOptional()
  aspect?: number; // "free" can be handled as null/undefined in the backend
}
