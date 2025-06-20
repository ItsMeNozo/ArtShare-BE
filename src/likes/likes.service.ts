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
    await this.verifyTargetExists(dto.target_id, dto.target_type);
    return await this.prisma.$transaction(async (tx) => {
      try {
        // 1️⃣ attempt to insert – the unique index stops duplicates
        const like = await tx.like.create({
          data: {
            user_id: userId,
            ...(dto.target_type === TargetType.POST
              ? { post_id: dto.target_id }
              : { blog_id: dto.target_id }),
          },
        });

        // 2️⃣ bump counter only on successful insert
        if (dto.target_type === TargetType.POST) {
          const postUpdated = await tx.post.update({
            where: { id: dto.target_id },
            data: { like_count: { increment: 1 } },
          });

          // Only send notification if the user is not liking their own post
          if (
            NotificationUtils.shouldSendNotification(
              userId,
              postUpdated.user_id,
            )
          ) {
            this.eventEmitter.emit('push-notification', {
              from: userId,
              to: postUpdated.user_id,
              type: 'artwork_liked',
              post: { id: postUpdated.id, title: postUpdated.title },
              postId: postUpdated.id.toString(),
              postTitle: postUpdated.title,
              createdAt: new Date(),
            });
          }
        } else {
          await tx.blog.update({
            where: { id: dto.target_id },
            data: { like_count: { increment: 1 } },
          });
        }

        return plainToClass(LikeDetailsDto, like);
      } catch (err: any) {
        // P2002 = duplicate-key (already liked)  ➜  no-op
        if (err?.code === 'P2002') {
          const existing = await this.findLike(
            dto.target_id,
            dto.target_type,
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
    await this.verifyTargetExists(dto.target_id, dto.target_type);

    return await this.prisma.$transaction(async (tx) => {
      // 1️⃣ delete rows (safe if none exist)
      const { count } = await tx.like.deleteMany({
        where: {
          user_id: userId,
          ...(dto.target_type === TargetType.POST
            ? { post_id: dto.target_id }
            : { blog_id: dto.target_id }),
        },
      });

      // 2️⃣ only decrement if something was actually deleted
      if (count > 0) {
        if (dto.target_type === TargetType.POST) {
          await tx.post.update({
            where: { id: dto.target_id },
            data: { like_count: { decrement: 1 } },
          });
        } else {
          await tx.blog.update({
            where: { id: dto.target_id },
            data: { like_count: { decrement: 1 } },
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
        where: { user_id: userId, post_id: targetId },
      });
    } else {
      return this.prisma.like.findFirst({
        where: { user_id: userId, blog_id: targetId },
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
          ? { blog_id: targetId }
          : { post_id: targetId },
    });

    // 2) Page of likes + user payload
    const likes = await this.prisma.like.findMany({
      where:
        targetType === TargetType.BLOG
          ? { blog_id: targetId }
          : { post_id: targetId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile_picture_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    });

    // 3) If logged in, compute follow‐status for this batch
    const followMap: Record<string, boolean> = {};
    if (requestingUserId) {
      const rows = await this.prisma.follow.findMany({
        where: {
          follower_id: requestingUserId,
          following_id: { in: likes.map((l) => l.user.id) },
        },
        select: { following_id: true },
      });
      rows.forEach((r) => (followMap[r.following_id] = true));
    }

    // 4) Map into DTO
    const items: LikingUserResponseDto[] = likes.map((l) => ({
      id: l.user.id,
      username: l.user.username,
      full_name: l.user.full_name ?? l.user.username,
      profile_picture_url: l.user.profile_picture_url,
      is_following: !!followMap[l.user.id],
    }));

    return { items, total };
  }
}
