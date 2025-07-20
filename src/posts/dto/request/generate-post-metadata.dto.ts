import { IsDefined, IsInt } from 'class-validator';

export class GeneratePostMetadataRequestDto {
  @IsInt()
  @IsDefined()
  promptId: number;
}
