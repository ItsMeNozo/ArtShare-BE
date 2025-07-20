export class BlogUserInfoResponseDto {
  id: string;
  username: string;
  profilePictureUrl?: string | null;
  fullName?: string | null;
  followersCount: number;
  isFollowing?: boolean;
}
