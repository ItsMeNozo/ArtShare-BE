import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum BlogSortBy {
  LATEST = 'latest',
  OLDEST = 'oldest',
}

export enum BlogDateRange {
  LAST_7_DAYS = 'last7days',
  LAST_30_DAYS = 'last30days',
  ALL = 'all',
}

export enum BlogSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export class UserBlogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number = 10;

  @IsOptional()
  @IsEnum(BlogSortBy)
  sortBy?: BlogSortBy = BlogSortBy.LATEST;

  @IsOptional()
  @IsEnum(BlogDateRange)
  dateRange?: BlogDateRange = BlogDateRange.ALL;

  @IsOptional()
  @IsEnum(BlogSortField)
  sortField?: BlogSortField = BlogSortField.CREATED_AT;
}
