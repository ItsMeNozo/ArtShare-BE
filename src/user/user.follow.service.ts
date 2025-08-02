import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ApiResponse as CustomApiResponse } from 'src/common/api-response';
import {
  FollowUnfollowDataDto,
  FollowUserResponseDto,
  UnfollowUserResponseDto,
} from 'src/common/dto/api-response.dto';
import { PrismaService } from '../prisma.service';
import { FollowerDto } from './dto/follower.dto';

@Injectable()
export class UserFollowService {
  private readonly logger = new Logger(UserFollowService.name);

  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async followUser(
    followerId: string,
    followingId: string,
  ): Promise<CustomApiResponse<FollowUnfollowDataDto>> {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself.');
    }

    // const existingFollow = await this.prisma.follow.findUnique({
    //   where: {
    //     followerId_followingId: {
    //       followerId: followerId,
    //       followingId: followingId,
    //     },
    //   },
    // });

    // if (existingFollow) {
    //   throw new ConflictException('Already following this user.');
    // }

    try {
      await this.prisma.$transaction([
        this.prisma.$executeRaw`
          INSERT INTO "follow" ("follower_id", "following_id") 
          VALUES (${followerId}, ${followingId})
        `,
        this.prisma
          .$executeRaw`UPDATE "user" SET "followings_count" = "followings_count" + 1 WHERE "id" = ${followerId}`,
        this.prisma
          .$executeRaw`UPDATE "user" SET "followers_count" = "followers_count" + 1 WHERE "id" = ${followingId}`,
      ]);

      this.eventEmitter.emit('push-notification', {
        from: followerId,
        to: followingId,
        type: 'user_followed',
        createdAt: new Date(),
      });

      const responseData: FollowUnfollowDataDto = { followerId, followingId };
      return new FollowUserResponseDto(
        true,
        'Followed successfully.',
        HttpStatus.CREATED,
        responseData,
      );
    } catch (error: any) {
      this.logger.error(
        `Follow transaction failed for ${followerId} -> ${followingId}:`,
        error,
      );
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2010'
      ) {
        throw new ConflictException('Already following this user.');
      }
      throw new InternalServerErrorException('Could not follow user.');
    }
  }

  async unfollowUser(
    followerId: string,
    followingId: string,
  ): Promise<CustomApiResponse<FollowUnfollowDataDto>> {
    try {
      await this.prisma.$transaction([
        this.prisma.follow.delete({
          where: {
            followerId_followingId: {
              followerId: followerId,
              followingId: followingId,
            },
          },
        }),
        this.prisma.user.update({
          where: { id: followerId },
          data: { followingsCount: { decrement: 1 } },
        }),
        this.prisma.user.update({
          where: { id: followingId },
          data: { followersCount: { decrement: 1 } },
        }),
      ]);
      const responseData: FollowUnfollowDataDto = { followerId, followingId };
      return new UnfollowUserResponseDto(
        true,
        'Unfollowed successfully.',
        HttpStatus.OK,
        responseData,
      );
    } catch (error: any) {
      this.logger.error(
        `Unfollow transaction failed for ${followerId} -> ${followingId}:`,
        error,
      );
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Follow relationship not found to delete.');
      }

      this.logger.error(`Unfollow failed for ${followerId}:`, error);
      throw new InternalServerErrorException('Could not unfollow user.');
    }
  }

  async getFollowersListByUserId(userId: string): Promise<FollowerDto[]> {
    const userExists = await this.prisma.user.count({ where: { id: userId } });
    if (userExists === 0) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const follows = await this.prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return follows
      .map((f) => {
        if (!f.follower) {
          this.logger.warn(
            `Follow record for followingId ${userId} is missing follower data. Follower ID: ${f.followerId}`,
          );
          return null;
        }
        return {
          id: f.follower.id,
          username: f.follower.username,
          fullName: f.follower.fullName,
          profilePictureUrl: f.follower.profilePictureUrl,
        };
      })
      .filter((follower) => follower !== null) as FollowerDto[];
  }

  async getFollowingsListByUserId(userId: string): Promise<FollowerDto[]> {
    const userExists = await this.prisma.user.count({ where: { id: userId } });
    if (userExists === 0) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return follows
      .map((f) => {
        if (!f.following) {
          this.logger.warn(
            `Follow record for followerId ${userId} is missing 'following' data. Following ID: ${f.followingId}`,
          );
          return null;
        }
        return {
          id: f.following.id,
          username: f.following.username,
          fullName: f.following.fullName,
          profilePictureUrl: f.following.profilePictureUrl,
        };
      })
      .filter((followingUser) => followingUser !== null) as FollowerDto[];
  }
}
