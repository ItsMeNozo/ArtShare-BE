import { ApiProperty } from '@nestjs/swagger';

export class CategorySimpleDto {
  @ApiProperty({
    example: 1,
    description: 'The unique identifier of the category.',
  })
  id: number;

  @ApiProperty({
    example: 'Oil Painting',
    description: 'The name of the category.',
  })
  name: string;
}
