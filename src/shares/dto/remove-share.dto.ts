import { IsEnum, IsInt } from 'class-validator';
import { TargetType } from '@prisma/client';

export class RemoveShareDto {
  @IsInt()
  target_id: number;

  @IsEnum(TargetType)
  target_type: TargetType; // e.g., POST or BLOG
}
