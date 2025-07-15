import { Role } from 'src/auth/enums/role.enum';
export class UserProfileDTO {
  id: string; // It's good practice to return the ID as well
  username: string;
  email: string;
  fullName?: string | null;
  profilePictureUrl?: string | null;
  bio?: string | null;
  followersCount: number;
  followingsCount: number;
  birthday?: Date | null;
  roles: Role[]; // Or string[] if you prefer simple strings from backend
  isFollowing: boolean;
  isOnboard: boolean;
  createdAt: Date;
}
