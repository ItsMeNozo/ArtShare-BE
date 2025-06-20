import { User } from 'src/generated';
import { PublicUserSearchResponseDto } from '../dto/response/search-users.dto';

export function mapToPublicUserSearchDto(
  user: User,
): PublicUserSearchResponseDto {
  return {
    username: user.username,
    fullName: user.full_name,
    profilePictureUrl: user.profile_picture_url,
    followersCount: user.followers_count,
    followingsCount: user.followings_count,
  };
}
