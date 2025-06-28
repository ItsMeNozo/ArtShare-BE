import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { TargetType } from 'src/generated';

export class GetCommentsQueryDto {
  @Type(() => Number)
  @IsInt()
  target_id: number;

  @IsEnum(TargetType, {
    message: `target_type must be one of: ${Object.values(TargetType).join(', ')}`,
  })
  target_type: TargetType;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  parent_comment_id?: number;
}
