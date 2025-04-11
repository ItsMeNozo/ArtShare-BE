import { IsOptional, IsInt, Min, IsString, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetBlogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}
