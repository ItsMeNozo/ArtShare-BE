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
        full_name: true,
        profile_picture_url: true,
        bio: true,
        followers_count: true,
        followings_count: true,
        birthday: true,
        is_onboard: true,
        created_at: true,
        roles: {
          select: {
            role: {
              select: {
                role_name: true,
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
      (userRole) => userRole.role.role_name as Role,
    );
    let isFollowing = false;
    if (currentUser.id !== user.id) {
      isFollowing =
        (await this.prisma.follow.count({
          where: {
            follower_id: currentUser.id,
            following_id: user.id,
          },
        })) > 0;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      profile_picture_url: user.profile_picture_url,
      bio: user.bio,
      followers_count: user.followers_count,
      followings_count: user.followings_count,
      birthday: user.birthday ?? null,
      roles: roleNames,
      isFollowing,
      is_onboard: user.is_onboard,
      created_at: user.created_at,
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
        full_name: true,
        profile_picture_url: true,
        bio: true,
        followers_count: true,
        followings_count: true,
        birthday: true,
        is_onboard: true,
        created_at: true,
        roles: {
          select: {
            role: {
              select: { role_name: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${currentUser.id} not found`);
    }

    const roleNames = user.roles.map((ur) => ur.role.role_name as Role);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      profile_picture_url: user.profile_picture_url,
      bio: user.bio,
      followers_count: user.followers_count,
      followings_count: user.followings_count,
      birthday: user.birthday ?? null,
      roles: roleNames,
      isFollowing: false, // By definition, you don't follow yourself in this context
      is_onboard: user.is_onboard,
      created_at: user.created_at,
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
      | 'full_name'
      | 'profile_picture_url'
      | 'bio'
      | 'birthday'
    > & { is_onboard: boolean } // Extend to include is_onboard in return type
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
      if (updateUserDto.full_name !== undefined)
        dataToUpdate.full_name = updateUserDto.full_name;
      if (updateUserDto.profile_picture_url !== undefined)
        dataToUpdate.profile_picture_url = updateUserDto.profile_picture_url;
      if (updateUserDto.bio !== undefined) dataToUpdate.bio = updateUserDto.bio;
      if (updateUserDto.birthday !== undefined) {
        dataToUpdate.birthday = updateUserDto.birthday
          ? new Date(updateUserDto.birthday)
          : null;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { ...dataToUpdate, is_onboard: true }, // Mark as onboarded on profile update
        select: {
          id: true, // Though not strictly in the Pick, often useful to return
          username: true,
          email: true,
          full_name: true,
          profile_picture_url: true,
          bio: true,
          birthday: true,
          is_onboard: true,
        },
      });
      // Cast to the more specific return type if needed, or adjust select
      return updatedUser as Pick<
        User,
        | 'username'
        | 'email'
        | 'full_name'
        | 'profile_picture_url'
        | 'bio'
        | 'birthday'
      > & { is_onboard: boolean };
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
}
