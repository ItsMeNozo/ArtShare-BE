import { Exclude } from 'class-transformer';

export class UserResponseDto {
  id: string;
  username: string;
  @Exclude() email: string;
  @Exclude() password_hash: string;
  full_name: string;
  profile_picture_url: string;
  @Exclude() bio: string;
  @Exclude() created_at: Date;
  @Exclude() updated_at: Date;
  @Exclude() refresh_token: string;
}
