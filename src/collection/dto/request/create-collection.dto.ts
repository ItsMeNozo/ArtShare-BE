import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCollectionDto {
  @ApiProperty({
    description: 'The name of the collection',
    example: 'My Favorite Art',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Whether the collection is private',
    example: false,
  })
  @IsBoolean()
  isPrivate: boolean;

  @ApiProperty({
    description: 'The description of the collection',
    example: 'A collection of my favorite art pieces.',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'The thumbnail URL of the collection',
    example: 'https://example.com/thumbnail.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  thumbnailUrl?: string;
}
