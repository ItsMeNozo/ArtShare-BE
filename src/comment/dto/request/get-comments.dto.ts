import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { TargetType } from 'src/generated';

export class GetCommentsDto {
  @IsInt()
  targetId: number;

  @IsEnum(TargetType)
  targetType: TargetType;

  @IsOptional()
  @IsInt()
  parentCommentId?: number;
}
