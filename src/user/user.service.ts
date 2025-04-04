import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service'; // Import PrismaService
import { User } from '@prisma/client'; // Import User type
import { UserProfileDTO } from './dto/user-profile.dto';
import { DeleteUsersDTO } from './dto/delete-users.dto';
import { UpdateUserDTO } from './dto/update-users.dto';
import { ApiResponse } from 'src/common/api-response';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Tìm người dùng theo email
  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  async getUserProfile(userId: string): Promise<UserProfileDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        full_name: true,
        profile_picture_url: true,
        bio: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  async updateUserProfile(userId: string, updateUserDto: UpdateUserDTO) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateUserDto,
        select: {
          username: true,
          email: true,
          full_name: true,
          profile_picture_url: true,
          bio: true,
        },
      });
      return updatedUser;
    } catch (error) {
      // Handle the case where the user is not found, or any other prisma related error.
      if (error.code === 'P2025') {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      throw error;
    }
  }

  // Lấy thông tin người dùng đầu tiên (findFirst)
  async findAll(): Promise<User[] | null> {
    return this.prisma.user.findMany(); // Hoặc có thể tùy chỉnh để tìm kiếm theo điều kiện khác
  }

  // Cập nhật thông tin người dùng
  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Xoá nhiều người dùng
  async deleteUsers(deleteUserDTO: DeleteUsersDTO): Promise<any> {
    return this.prisma.user.deleteMany({
      where: {
        id: {
          in: deleteUserDTO.userIds,
        },
      },
    });
  }

  async deleteUserById(userId: string): Promise<any> {
    return this.prisma.user.delete({
      where: {
        id: userId,
      },
    });
  }

  async followUser(
    followerId: string,
    followingId: string,
  ): Promise<ApiResponse<any>> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself.');
    }

    const [followerExists, followingExists] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: followerId },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: followingId },
        select: { id: true },
      }),
    ]);

    if (!followerExists || !followingExists) {
      // Throw NotFoundException if either user doesn't exist
      const notFoundUserId = !followerExists ? followerId : followingId;
      throw new NotFoundException(`User with ID ${notFoundUserId} not found.`);
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        follower_id_following_id: {
          follower_id: followerId,
          following_id: followingId,
        },
      },
    });

    if (existingFollow) {
      throw new ConflictException('Already following this user.');
    }

    try {
      await this.prisma.follow.create({
        data: {
          follower_id: followerId,
          following_id: followingId,
        },
      });

      // 5. Return standard success response
      return {
        success: true,
        message: 'Followed successfully.',
        statusCode: HttpStatus.CREATED, // Use 201 Created for successful creation
      };
    } catch (error) {
      // Catch potential database errors during creation
      throw new HttpException(
        'Could not follow user.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: error },
      );
    }
  }

  async unfollowUser(
    followerId: string,
    followingId: string,
  ): Promise<ApiResponse<any>> {
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        follower_id_following_id: {
          follower_id: followerId,
          following_id: followingId,
        },
      },
    });

    if (!existingFollow) {
      throw new NotFoundException('You are not following this user.');
    }

    try {
      await this.prisma.follow.delete({
        where: {
          follower_id_following_id: {
            follower_id: followerId,
            following_id: followingId,
          },
        },
      });

      // 5. Return standard success response
      return {
        success: true,
        message: 'Unfollowed successfully.',
        statusCode: HttpStatus.OK, // Use 200 OK for successful update/delete
      };
    } catch (error) {
      // Catch potential database errors during deletion (though P2025 handled above)
      // Prisma's P2025 error (Record to delete does not exist) should ideally be caught
      // by the `followToDelete` check above, but this is a fallback.
      if (error.code === 'P2025') {
        throw new NotFoundException('Follow relationship not found to delete.'); // More specific
      }
      throw new HttpException(
        'Could not unfollow user.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: error },
      );
    }
  }
}
