import { IsArray, IsString } from 'class-validator';

export class UpdatePromptHistoryDto {
  @IsArray()
  @IsString({ each: true })
  imageUrls: string[];
}
