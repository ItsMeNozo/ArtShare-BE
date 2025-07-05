import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Role } from 'src/auth/enums/role.enum';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { Prisma, User } from 'src/generated';
import { PrismaService } from '../prisma.service';
import { UserProfileMeDTO } from './dto/get-user-me.dto';
import { UpdateUserDTO } from './dto/update-users.dto';
import { UserProfileDTO } from './dto/user-profile.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private prisma: PrismaService) {}

  async getUserProfile(
    userId: string,
    currentUser: CurrentUserType,
  ): Promise<UserProfileDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        profilePictureUrl: true,
        bio: true,
        followersCount: true,
        followingsCount: true,
        birthday: true,
        isOnboard: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: {
                roleName: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const roleNames = user.roles.map(
      (userRole) => userRole.role.roleName as Role,
    );
    let isFollowing = false;
    if (currentUser.id !== user.id) {
      isFollowing =
        (await this.prisma.follow.count({
          where: {
            followerId: currentUser.id,
            followingId: user.id,
          },
        })) > 0;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      followersCount: user.followersCount,
      followingsCount: user.followingsCount,
      birthday: user.birthday ?? null,
      roles: roleNames,
      isFollowing,
      isOnboard: user.isOnboard,
      createdAt: user.createdAt,
    };
  }

  async getUserProfileForMe(
    currentUser: CurrentUserType,
  ): Promise<UserProfileMeDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        profilePictureUrl: true,
        bio: true,
        followersCount: true,
        followingsCount: true,
        birthday: true,
        isOnboard: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: { roleName: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${currentUser.id} not found`);
    }

    const roleNames = user.roles.map((ur) => ur.role.roleName as Role);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      followersCount: user.followersCount,
      followingsCount: user.followingsCount,
      birthday: user.birthday ?? null,
      roles: roleNames,
      isFollowing: false, // By definition, you don't follow yourself in this context
      isOnboard: user.isOnboard,
      createdAt: user.createdAt,
    };
  }

  async getUserProfileByUsername(
    username: string,
    currentUser: CurrentUserType,
  ): Promise<UserProfileDTO> {
    const record = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!record) {
      throw new NotFoundException(
        `User with username "${username}" not found.`,
      );
    }

    return this.getUserProfile(record.id, currentUser);
  }

  async updateUserProfile(
    userId: string,
    updateUserDto: UpdateUserDTO,
  ): Promise<
    Pick<
      User,
      | 'username'
      | 'email'
      | 'fullName'
      | 'profilePictureUrl'
      | 'bio'
      | 'birthday'
    > & { isOnboard: boolean } // Extend to include is_onboard in return type
  > {
    try {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!currentUser)
        throw new NotFoundException(`User with ID ${userId} not found.`);

      if (updateUserDto.email && updateUserDto.email !== currentUser.email) {
        const emailConflict = await this.prisma.user.findUnique({
          where: { email: updateUserDto.email },
        });
        if (emailConflict && emailConflict.id !== userId) {
          throw new ConflictException(
            `Email '${updateUserDto.email}' is already in use.`,
          );
        }
      }
      if (
        updateUserDto.username &&
        updateUserDto.username !== currentUser.username
      ) {
        const usernameConflict = await this.prisma.user.findUnique({
          where: { username: updateUserDto.username },
        });
        if (usernameConflict && usernameConflict.id !== userId) {
          throw new ConflictException(
            `Username '${updateUserDto.username}' is already in use.`,
          );
        }
      }

      const dataToUpdate: Prisma.UserUpdateInput = {};
      if (updateUserDto.username !== undefined)
        dataToUpdate.username = updateUserDto.username;
      if (updateUserDto.email !== undefined)
        dataToUpdate.email = updateUserDto.email;
      if (updateUserDto.fullName !== undefined)
        dataToUpdate.fullName = updateUserDto.fullName;
      if (updateUserDto.profilePictureUrl !== undefined)
        dataToUpdate.profilePictureUrl = updateUserDto.profilePictureUrl;
      if (updateUserDto.bio !== undefined) dataToUpdate.bio = updateUserDto.bio;
      if (updateUserDto.birthday !== undefined) {
        dataToUpdate.birthday = updateUserDto.birthday
          ? new Date(updateUserDto.birthday)
          : null;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { ...dataToUpdate, isOnboard: true }, // Mark as onboarded on profile update
        select: {
          id: true, // Though not strictly in the Pick, often useful to return
          username: true,
          email: true,
          fullName: true,
          profilePictureUrl: true,
          bio: true,
          birthday: true,
          isOnboard: true,
        },
      });
      // Cast to the more specific return type if needed, or adjust select
      return updatedUser as Pick<
        User,
        | 'username'
        | 'email'
        | 'fullName'
        | 'profilePictureUrl'
        | 'bio'
        | 'birthday'
      > & { isOnboard: boolean };
    } catch (error: any) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025')
          throw new NotFoundException(`User with ID ${userId} not found.`);
        if (error.code === 'P2002') {
          const target =
            (error.meta?.target as string[])?.join(', ') || 'a unique field';
          throw new ConflictException(
            `Duplicate value for field(s): ${target}.`,
          );
        }
      }
      if (error instanceof HttpException) throw error;
      this.logger.error(`Could not update user profile for ${userId}:`, error);
      throw new InternalServerErrorException('Could not update user profile.');
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    // Consider if this generic update is still needed or if all updates
    // should go through more specific DTO-validated methods.
    return this.prisma.user.update({ where: { id }, data });
  }

  async getAdminUserIds(): Promise<string[]> {
    const result = await this.prisma.$queryRaw<{id: string}[]>`
      select u.id
      from "user" u
      where u.id in (
        select "userId" from user_role ur where ur."roleId" = 1
      )
    `;
    return result.map(row => row.id);
  }
}
