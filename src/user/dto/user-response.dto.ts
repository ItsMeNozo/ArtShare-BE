import { ApiProperty } from '@nestjs/swagger';
import { Role } from 'src/auth/enums/role.enum';
import { UserAccess, UserStatus } from 'src/generated';

export class UserResponseDto {
  @ApiProperty({ example: 'clx2k1z9z0000q8pjh9g1c2d3', description: 'User ID' })
  id: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User display name',
    nullable: true,
  })
  fullName?: string | null;

  @ApiProperty({ example: 'johndoe', description: 'Username' })
  username: string;

  @ApiProperty({
    example: 'http://example.com/avatar.jpg',
    description: 'Avatar URL',
    nullable: true,
  })
  profilePictureUrl?: string | null;

  @ApiProperty({
    example: 'A short bio about the user.',
    description: 'User bio',
    nullable: true,
  })
  bio?: string | null;

  @ApiProperty({
    enum: Role,
    isArray: true,
    example: [Role.USER],
    description: 'User roles',
  })
  roles: Role[];

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Last update timestamp',
    nullable: true,
  })
  updatedAt: Date | null;

  @ApiProperty({
    example: '1990-01-01T00:00:00.000Z',
    description: 'User birthday',
    nullable: true,
  })
  birthday?: Date | null;

  @ApiProperty({ example: 100, description: 'Number of followers' })
  followersCount: number;

  @ApiProperty({ example: 50, description: 'Number of followings' })
  followingsCount: number;

  @ApiProperty({
    enum: UserStatus,
    example: UserStatus.ACTIVE,
    description: "The user's account status.",
  })
  status: UserStatus;

  userAccess: UserAccess | null;
}

export class DeleteUserByIdResponseDto {
  @ApiProperty({
    description: 'A summary message indicating the result of the deletion.',
    example: 'User with ID xyz deleted successfully from Firebase and DB.',
  })
  message: string;

  @ApiProperty({
    description:
      'Indicates if the user was successfully deleted from Firebase.',
    example: true,
  })
  firebaseDeleted: boolean;

  @ApiProperty({
    description:
      'Indicates if the user was successfully deleted from the database.',
    example: true,
  })
  dbDeleted: boolean;
}

class FirebaseErrorDetailDto {
  @ApiProperty({
    description: 'Original index of the UID in the request array.',
    example: 0,
  })
  index: number;

  @ApiProperty({
    description: 'The UID that failed to be deleted from Firebase.',
    example: 'firebase-uid-1',
  })
  uid: string;

  @ApiProperty({
    description: 'Reason for the Firebase deletion failure.',
    example: 'User not found.',
  })
  reason: string;

  @ApiProperty({
    description: 'Firebase error code (e.g., auth/user-not-found).',
    example: 'auth/user-not-found',
    required: false,
  })
  code?: string;
}

class FirebaseDeletionResultDto {
  @ApiProperty({
    description: 'Number of users successfully deleted from Firebase.',
    example: 5,
  })
  successCount: number;

  @ApiProperty({
    description: 'Number of users that failed to be deleted from Firebase.',
    example: 1,
  })
  failureCount: number;

  @ApiProperty({
    description: 'Details of users that failed to be deleted from Firebase.',
    type: [FirebaseErrorDetailDto],
  })
  errors: FirebaseErrorDetailDto[];
}

class PrismaDeletionResultDto {
  @ApiProperty({
    description:
      'Number of users successfully deleted from the Prisma database.',
    example: 6,
  })
  deletedCount: number;

  @ApiProperty({
    description: 'Number of user IDs requested for deletion.',
    example: 6,
  })
  requestedCount: number;
}

export class DeleteMultipleUsersResponseDto {
  @ApiProperty({
    description:
      'A summary message indicating the overall result of the batch deletion.',
    example:
      'Processed deletion for 6 user IDs. Firebase: 5 deleted, 1 failed. Prisma DB: 6 deleted.',
  })
  message: string;

  @ApiProperty({ description: 'Results of the Firebase deletion attempts.' })
  firebase: FirebaseDeletionResultDto;

  @ApiProperty({
    description: 'Results of the Prisma database deletion attempts.',
  })
  prisma: PrismaDeletionResultDto;
}

export class DeleteUsersDTO {
  @ApiProperty({
    description: 'Array of user IDs to delete.',
    type: [String],
    example: ['user-id-1', 'user-id-2'],
  })
  userIds: string[];
}
