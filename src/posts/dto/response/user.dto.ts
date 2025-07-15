import { Exclude } from 'class-transformer';

export class UserResponseDto {
  id: string;
  username: string;
  @Exclude() email: string;
  fullName: string;
  profilePictureUrl: string;
  @Exclude() bio: string;
  @Exclude() createdAt: Date;
  @Exclude() updatedAt: Date;
  @Exclude() refreshToken: string;
}
