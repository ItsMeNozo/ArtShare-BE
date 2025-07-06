import { IsInt, IsOptional, Min } from 'class-validator';

export class GetPromptHistoryQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;
}
