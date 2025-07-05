import { User } from 'src/generated';
import { PublicUserSearchResponseDto } from '../dto/response/search-users.dto';

export function mapToPublicUserSearchDto(
  user: User,
): PublicUserSearchResponseDto {
  return {
    username: user.username,
    fullName: user.fullName,
    profilePictureUrl: user.profilePictureUrl,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
  };
}
