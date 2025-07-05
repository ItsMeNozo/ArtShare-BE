import { Expose } from 'class-transformer';

/**
 * DTO for returning a user who liked a blog or post.
 */
export class LikingUserResponseDto {
  /** The UUID of the user */
  @Expose()
  id: string;

  /** The user's unique username */
  @Expose()
  username: string;

  /** The user's full name */
  @Expose()
  fullName: string;

  /** URL of the user's profile picture, or null if none */
  @Expose()
  profilePictureUrl: string | null;

  /** Whether the current user is following this user */
  @Expose()
  isFollowing: boolean;
}
