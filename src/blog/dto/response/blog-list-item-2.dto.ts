import { ApiProperty } from '@nestjs/swagger';
import { BlogUserInfoResponseDto } from './blog-user-info.dto';

export class BlogListItem2ResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'My Amazing Blog Post' })
  title: string;

  @ApiProperty({ example: '2025-05-31T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: () => BlogUserInfoResponseDto })
  user: BlogUserInfoResponseDto;

  @ApiProperty({ example: true })
  isPublished: boolean;

  likeCount: number;
  commentCount: number;

  @ApiProperty({
    type: [String],
    example: [
      'https://cdn.example.com/img1.jpg',
      'https://cdn.example.com/img2.png',
    ],
    description:
      'An array of URLs (or file paths) pointing to each picture associated with this blog post',
  })
  pictures: string[];
}
