import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TargetType } from 'src/generated';

export class CreateCommentDto {
  @ApiProperty({
    description: 'The content of the comment',
    minLength: 1,
    example: 'This is a great post!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiProperty({
    description: 'The ID of the target entity (Post or Blog)',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  target_id: number;

  @ApiProperty({
    description: 'The type of the target entity',
    enum: TargetType,
    example: TargetType.POST,
  })
  @IsEnum(TargetType)
  @IsNotEmpty()
  target_type: TargetType;

  @ApiPropertyOptional({
    description: 'The ID of the parent comment if this is a reply',
    example: 5,
  })
  @IsInt()
  @IsOptional()
  parent_comment_id?: number; // Only for replies
}
