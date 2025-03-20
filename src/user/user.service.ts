import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service'; // Import PrismaService
import { User } from '@prisma/client'; // Import User type
import { UserProfileDTO } from './dto/user-profile.dto';
import { UpdateUserDTO } from './dto/update-user.dto';
import { DeleteUsersDTO } from './dto/delete-users.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(data: {
    email: string;
    password_hash: string;
    username: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  // Tìm người dùng theo email
  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  // Get user profile by userID (passed from token)
  async getUserProfile(userId: number): Promise<UserProfileDTO> {
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

  async updateUserProfile(userId: number, updateUserDto: UpdateUserDTO) {
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
  async updateUser(id: number, data: Partial<User>): Promise<User> {
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

  async deleteUserById(userId: number): Promise<any> {
    return this.prisma.user.delete({
      where: {
        id: userId,
      },
    });
  }

  async followUser(followerId: number, followingId: number): Promise<string> {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself.');
    }

    const followerExists = await this.prisma.user.findUnique({
      where: { id: followerId },
    });

    const followingExists = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!followerExists || !followingExists) {
      return 'User not found';
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
      return 'Already following.';
    }

    await this.prisma.follow.create({
      data: {
        follower_id: followerId,
        following_id: followingId,
      },
    });
    return 'Followed successfully.';
  }

  async unfollowUser(followerId: number, followingId: number): Promise<string> {
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        follower_id_following_id: {
          follower_id: followerId,
          following_id: followingId,
        },
      },
    });

    if (!existingFollow) {
      return 'Not following';
    }

    await this.prisma.follow.delete({
      where: {
        follower_id_following_id: {
          follower_id: followerId,
          following_id: followingId,
        },
      },
    });
    return 'Unfollowed successfully.';
  }
}
