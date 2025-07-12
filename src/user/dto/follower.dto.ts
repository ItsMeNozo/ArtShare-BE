// src/user/dto/follower.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class FollowerDto {
  @ApiProperty({ example: 'u12345' })
  id: string;

  @ApiProperty({ example: 'alice' })
  username: string;

  @ApiProperty({ example: 'Alice Smith', nullable: true })
  fullName: string | null;

  @ApiProperty({
    nullable: true,
  })
  profilePictureUrl: string | null;
}
