import { IsEnum, IsInt } from 'class-validator';
import { TargetType } from 'src/generated';

export class CreateLikeDto {
  @IsInt()
  targetId: number;

  @IsEnum(TargetType)
  targetType: TargetType;
}
