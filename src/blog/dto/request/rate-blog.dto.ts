import { IsInt, Min, Max } from 'class-validator';

export class RateBlogDto {
  @IsInt()
  @Min(1)
  @Max(5) 
  rating: number;
}
