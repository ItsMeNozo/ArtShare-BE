import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToClass } from 'class-transformer';
import { TryCatch } from 'src/common/try-catch.decorator';
import { TargetType } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { NotificationUtils } from '../common/utils/notification.utils';
import { CreateLikeDto } from './dto/request/create-like.dto';
import { RemoveLikeDto } from './dto/request/remove-like.dto';
import { LikeDetailsDto } from './dto/response/like-details.dto';
import { LikingUserResponseDto } from './dto/response/liking-user-response.dto';

@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @TryCatch('create like failed')
  async createLike(
    dto: CreateLikeDto,
    userId: string,
  ): Promise<LikeDetailsDto> {
    await this.verifyTargetExists(dto.targetId, dto.targetType);
    return await this.prisma.$transaction(async (tx) => {
      try {
        // 1️⃣ attempt to insert – the unique index stops duplicates
        const like = await tx.like.create({
          data: {
            userId: userId,
            ...(dto.targetType === TargetType.POST
              ? { postId: dto.targetId }
              : { blogId: dto.targetId }),
          },
        });

        // 2️⃣ bump counter only on successful insert
        if (dto.targetType === TargetType.POST) {
          const postUpdated = await tx.post.update({
            where: { id: dto.targetId },
            data: { likeCount: { increment: 1 } },
          });

          // Only send notification if the user is not liking their own post
          if (
            NotificationUtils.shouldSendNotification(userId, postUpdated.userId)
          ) {
            this.eventEmitter.emit('push-notification', {
              from: userId,
              to: postUpdated.userId,
              type: 'artwork_liked',
              post: { id: postUpdated.id, title: postUpdated.title },
              postId: postUpdated.id.toString(),
              postTitle: postUpdated.title,
              createdAt: new Date(),
            });
          }
        } else {
          await tx.blog.update({
            where: { id: dto.targetId },
            data: { likeCount: { increment: 1 } },
          });
        }

        return plainToClass(LikeDetailsDto, like);
      } catch (err: any) {
        // P2002 = duplicate-key (already liked)  ➜  no-op
        if (err?.code === 'P2002') {
          const existing = await this.findLike(
            dto.targetId,
            dto.targetType,
            userId,
          );
          return plainToClass(LikeDetailsDto, existing);
        }
        throw err; // unknown error bubbles up to @TryCatch
      }
    });
  }

  @TryCatch('remove like failed')
  async removeLike(
    dto: RemoveLikeDto,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.verifyTargetExists(dto.targetId, dto.targetType);

    return await this.prisma.$transaction(async (tx) => {
      // 1️⃣ delete rows (safe if none exist)
      const { count } = await tx.like.deleteMany({
        where: {
          userId: userId,
          ...(dto.targetType === TargetType.POST
            ? { postId: dto.targetId }
            : { blogId: dto.targetId }),
        },
      });

      // 2️⃣ decrement counter only if a row was deleted
      if (count > 0) {
        if (dto.targetType === TargetType.POST) {
          await tx.post.update({
            where: { id: dto.targetId },
            data: { likeCount: { decrement: 1 } },
          });
        } else {
          await tx.blog.update({
            where: { id: dto.targetId },
            data: { likeCount: { decrement: 1 } },
          });
        }
      }

      return { success: true };
    });
  }

  private async verifyTargetExists(targetId: number, targetType: TargetType) {
    if (targetType === TargetType.POST) {
      const post = await this.prisma.post.findUnique({
        where: { id: targetId },
      });
      if (!post) throw new BadRequestException('Post not found');
    } else {
      const blog = await this.prisma.blog.findUnique({
        where: { id: targetId },
      });
      if (!blog) throw new BadRequestException('Blog not found');
    }
  }

  private async findLike(
    targetId: number,
    targetType: TargetType,
    userId: string,
  ) {
    if (targetType === TargetType.POST) {
      return this.prisma.like.findFirst({
        where: { userId: userId, postId: targetId },
      });
    } else {
      return this.prisma.like.findFirst({
        where: { userId: userId, blogId: targetId },
      });
    }
  }

  /**
   * Fetch a page of users who liked a given target (post or blog),
   * and also return the total number of likes for paging.
   */
  public async getLikingUsers(
    targetId: number,
    targetType: TargetType,
    requestingUserId: string | null,
    skip = 0,
    take = 20,
  ): Promise<{ items: LikingUserResponseDto[]; total: number }> {
    // 1) Total count
    const total = await this.prisma.like.count({
      where:
        targetType === TargetType.BLOG
          ? { blogId: targetId }
          : { postId: targetId },
    });

    // 2) Page of likes + user payload
    const likes = await this.prisma.like.findMany({
      where:
        targetType === TargetType.BLOG
          ? { blogId: targetId }
          : { postId: targetId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePictureUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    // 3) If logged in, compute follow‐status for this batch
    const followMap: Record<string, boolean> = {};
    if (requestingUserId) {
      const rows = await this.prisma.follow.findMany({
        where: {
          followerId: requestingUserId,
          followingId: { in: likes.map((l) => l.user.id) },
        },
        select: { followingId: true },
      });
      rows.forEach((r) => (followMap[r.followingId] = true));
    }

    // 4) Map into DTO
    const items: LikingUserResponseDto[] = likes.map((l) => ({
      id: l.user.id,
      username: l.user.username,
      fullName: l.user.fullName ?? l.user.username,
      profilePictureUrl: l.user.profilePictureUrl,
      isFollowing: !!followMap[l.user.id],
    }));

    return { items, total };
  }
}
