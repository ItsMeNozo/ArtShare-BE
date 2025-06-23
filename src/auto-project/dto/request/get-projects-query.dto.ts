import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { SortableProjectKey } from 'src/auto-project/enum/index.enum';
import { SortOrder } from 'src/generated/internal/prismaNamespace';

export class GetProjectsQuery {
  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsString()
  @IsEnum(SortableProjectKey)
  sortBy?: SortableProjectKey;

  @IsOptional()
  @IsString()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
