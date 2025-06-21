import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { AutoPostStatus } from 'src/generated';

export class ScheduleAutoPostDto {
  @IsNotEmpty()
  @IsInt()
  @Transform(({ value }) => parseInt(value, 10))
  autoProjectId: number;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @IsArray()
  @IsOptional()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}

export class UpdateAutoPostStatusDto {
  @IsNotEmpty()
  @IsInt()
  @Transform(({ value }) => parseInt(value, 10))
  autoPostId: number;

  @IsNotEmpty()
  @IsIn(Object.values(AutoPostStatus))
  status: AutoPostStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  n8nExecutionId?: string;

  @IsOptional()
  @IsString()
  platformPostId?: string;
}

export class UpdateAutoPostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}

export class GetAutoPostsQueryDto {
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value, 10))
  autoProjectId?: number;

  @IsOptional()
  @IsIn(Object.values(AutoPostStatus))
  status?: AutoPostStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'scheduled_at';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
