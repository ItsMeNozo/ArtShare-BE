import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { TargetType } from 'src/generated';

export class GetCommentsDto {
  @IsInt()
  target_id: number;

  @IsEnum(TargetType)
  target_type: TargetType;

  @IsOptional()
  @IsInt()
  parent_comment_id?: number;
}
