import { Role } from "src/auth/enums/role.enum";

export class UserProfileMeDTO {
  id: string; // It's good practice to return the ID as well
  username: string;
  email: string;
  fullName?: string | null;
  profilePictureUrl?: string | null;
  bio?: string | null;
  followersCount: number;
  followingsCount: number;
  birthday?: Date | null;
  roles: Role[];
  isFollowing: boolean;
  isOnboard: boolean;
  createdAt: Date;
}