import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt } from 'class-validator';
import { TargetType } from 'src/generated';

export class CreateLikeDto {
  @IsInt()
  target_id: number;

  @IsEnum(TargetType)
  @ApiProperty({ type: () => TargetType })
  target_type: TargetType;
}
