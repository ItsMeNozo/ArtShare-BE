import { IsEnum, IsInt } from 'class-validator';
import { TargetType } from 'src/generated';

export class CreateLikeDto {
  @IsInt()
  target_id: number;

  @IsEnum(TargetType)
  target_type: TargetType;
}
