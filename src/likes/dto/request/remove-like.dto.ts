import { IsInt, IsEnum } from 'class-validator';
import { TargetType } from '@prisma/client';

export class RemoveLikeDto {
  @IsInt()
  target_id: number;

  @IsEnum(TargetType)
  target_type: TargetType;
}
