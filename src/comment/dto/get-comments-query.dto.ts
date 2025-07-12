import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { TargetType } from 'src/generated';

export class GetCommentsQueryDto {
  @Type(() => Number)
  @IsInt()
  targetId: number;

  @IsEnum(TargetType, {
    message: `targetType must be one of: ${Object.values(TargetType).join(', ')}`,
  })
  targetType: TargetType;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  parentCommentId?: number;
}
