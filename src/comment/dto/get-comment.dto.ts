// src/comment/dto/comment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/*  ────────────────────────────────────────────────
    A tiny “user card” (shown beside each comment)
*/
export class UserBriefDto {
  @ApiProperty({ example: 'u_12345' })
  id: string;

  @ApiProperty({ example: 'alice' })
  username: string;

  @ApiProperty({
    example: 'https://cdn.example.com/avatars/u_12345.jpg',
    nullable: true,
  })
  profilePictureUrl: string | null;
}


export class CommentReplyDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: 'Thanks for the clarification!' })
  content: string;

  @ApiProperty({ example: '2025-05-14T20:15:22.000Z' })
  createdAt: Date;

  @ApiProperty({ example: true })
  likedByCurrentUser: boolean;

  @ApiProperty({ type: () => UserBriefDto })
  @Type(() => UserBriefDto)
  user: UserBriefDto;
}

export class CommentDto {
  @ApiProperty({ example: 17 })
  id: number;

  @ApiProperty({ example: 'Great post—thanks for sharing!' })
  content: string;

  @ApiProperty({ example: '2025-05-14T20:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: false })
  likedByCurrentUser: boolean;

  @ApiProperty({ example: 5 })
  replyCount: number;

  @ApiProperty({ type: () => UserBriefDto })
  @Type(() => UserBriefDto)
  user: UserBriefDto;
}
