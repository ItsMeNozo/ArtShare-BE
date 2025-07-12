import { IsEnum, IsInt } from 'class-validator';
import { TargetType } from 'src/generated';

export class RemoveLikeDto {
  @IsInt()
  targetId: number;

  @IsEnum(TargetType)
  targetType: TargetType;
}
