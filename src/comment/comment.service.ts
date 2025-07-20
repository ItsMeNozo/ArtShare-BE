import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { TryCatch } from 'src/common/try-catch.decorator';
import { Comment, TargetType } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { NotificationUtils } from '../common/utils/notification.utils';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentDto } from './dto/get-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCommentDto, userId: string): Promise<Comment> {
    const { content, targetId, targetType, parentCommentId } = dto;

    if (parentCommentId != null) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: parentCommentId },
        select: { id: true, targetId: true, targetType: true },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent comment ${parentCommentId} not found.`,
        );
      }
      if (parent.targetId !== targetId || parent.targetType !== targetType) {
        throw new BadRequestException(
          `Cannot reply: parent belongs to a different target.`,
        );
      }
    }

    let ownerPostId = null;
    let postTitle = null;

    if (targetType === TargetType.POST) {
      const post = await this.prisma.post.findUnique({
        where: { id: targetId },
      });
      if (!post) {
        throw new NotFoundException(`Post ${targetId} not found.`);
      }
      ownerPostId = post.userId;
      postTitle = post.title;
    } else if (targetType === TargetType.BLOG) {
      const blog = await this.prisma.blog.findUnique({
        where: { id: targetId },
      });
      if (!blog) {
        throw new NotFoundException(`Blog ${targetId} not found.`);
      }
    } else {
      throw new BadRequestException(`Invalid targetType: ${targetType}`);
    }

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const newComment = await tx.comment.create({
            data: {
              content,
              userId: userId,
              targetId,
              targetType,
              parentCommentId,
            },
            include: {
              user: {
                select: { id: true, username: true, profilePictureUrl: true },
              },
              replies: {
                select: {
                  id: true,
                  content: true,
                  createdAt: true,
                  likeCount: true,
                  user: {
                    select: {
                      id: true,
                      username: true,
                      profilePictureUrl: true,
                    },
                  },
                },
              },
            },
          });

          if (targetType === TargetType.POST) {
            await tx.post.update({
              where: { id: targetId },
              data: { commentCount: { increment: 1 } },
            });
            let userIsReplied = null;
            if (dto.parentCommentId != null) {
              userIsReplied = await this.prisma.comment.findFirst({
                where: { parentCommentId: dto.parentCommentId },
                select: { userId: true },
              });
            }

            // Only send notification if the user is not commenting on their own post
            const targetUserId =
              userIsReplied == null ? ownerPostId : userIsReplied.userId;
            if (
              targetUserId &&
              NotificationUtils.shouldSendNotification(userId, targetUserId)
            ) {
              this.eventEmitter.emit('push-notification', {
                from: userId,
                to: targetUserId,
                type: 'artwork_commented',
                post: { title: postTitle ? postTitle : 'post' },
                comment: { text: dto.content },
                postId: targetId.toString(),
                commentId: newComment.id.toString(),
                postTitle: postTitle ? postTitle : 'post',
                createdAt: new Date(),
              });
            }
          } else {
            await tx.blog.update({
              where: { id: targetId },
              data: { commentCount: { increment: 1 } },
            });
          }

          return newComment;
        },
        {
          maxWait: 5000, // wait up to 5 s to acquire a connection (default 2 s)
          timeout: 15000, // allow up to 15 s for the transaction to complete
        },
      );

      return created;
    } catch (err: any) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === 'P2003') {
          throw new NotFoundException(
            `Related entity not found: ${err.meta?.field_name}`,
          );
        }
      }
      console.error('Create comment failed', { dto, userId, err });
      throw new InternalServerErrorException('Could not create comment.');
    }
  }

  @TryCatch()
  async getComments(
    targetId: number,
    targetType: TargetType,
    currentUserId?: string,
    parentCommentId?: number,
  ): Promise<CommentDto[]> {
    const comments = await this.prisma.comment.findMany({
      where: {
        targetId: targetId,
        targetType: targetType,
        parentCommentId: parentCommentId ?? null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, profilePictureUrl: true },
        },
        _count: { select: { replies: true } },
      },
    });

    //* gather IDs of comments **and** their included replies */
    const ids: number[] = [];
    comments.forEach((c: any) => {
      ids.push(c.id);
      c.replies?.forEach((r: any) => ids.push(r.id));
    });
    const likedRows = currentUserId
      ? await this.prisma.commentLike.findMany({
          where: { userId: currentUserId, commentId: { in: ids } },
          select: { commentId: true },
        })
      : [];
    const likedSet = new Set(likedRows.map((l) => l.commentId));

    /* ❷ map every record to DTO, surfacing `replyCount` ---------- */
    return comments.map((commentPrisma): CommentDto => {
      const { _count: prismaCount, ...restOfCommentFields } = commentPrisma;

      return {
        ...restOfCommentFields,
        likedByCurrentUser: likedSet.has(commentPrisma.id),
        replyCount: prismaCount.replies,
      };
    });
  }

  async update(
    commentId: number,
    dto: UpdateCommentDto,
    userId: string,
  ): Promise<Comment> {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    });
    if (!existing) {
      throw new NotFoundException(`Comment with ID ${commentId} not found.`);
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException(`You cannot edit someone else's comment.`);
    }

    try {
      return await this.prisma.comment.update({
        where: { id: commentId },
        data: {
          content: dto.content,
        },
      });
    } catch (err: any) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(`Comment with ID ${commentId} not found.`);
      }
      console.error('Error updating comment', { commentId, dto, err });
      throw new InternalServerErrorException('Could not update the comment.');
    }
  }

  async remove(commentId: number, userId: string): Promise<void> {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        targetId: true,
        targetType: true,
      },
    });
    if (!existing) {
      throw new NotFoundException(`Comment ${commentId} not found.`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException(`You cannot delete someone else's comment.`);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const deleteResult = await tx.comment.deleteMany({
          where: { parentCommentId: commentId },
        });
        const repliesRemoved = deleteResult.count;
        await tx.comment.delete({ where: { id: commentId } });

        const totalToDecrement = 1 + repliesRemoved;
        if (existing.targetType === TargetType.POST) {
          await tx.post.update({
            where: { id: existing.targetId },
            data: { commentCount: { decrement: totalToDecrement } },
          });
        } else {
          await tx.blog.update({
            where: { id: existing.targetId },
            data: { commentCount: { decrement: totalToDecrement } },
          });
        }
      });
    } catch (err: any) {
      // If deleteMany / delete missed, Prisma throws P2025
      if (err?.code === 'P2025') {
        throw new NotFoundException(`Comment ${commentId} no longer exists.`);
      }
      console.error('Error deleting comment', { commentId, err });
      throw new InternalServerErrorException('Could not delete the comment.');
    }
  }

  async likeComment(userId: string, commentId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.commentLike.create({
        data: { userId: userId, commentId: commentId },
      });
      await tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
      });
    });
  }

  async unlikeComment(userId: string, commentId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.commentLike.delete({
        where: {
          userId_commentId: { userId: userId, commentId: commentId },
        },
      });
      await tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
      });
    });
  }
}
