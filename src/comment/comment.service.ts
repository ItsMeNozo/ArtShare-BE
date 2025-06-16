import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment, TargetType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentDto } from './dto/get-comment.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationUtils } from '../common/utils/notification.utils';
import { TryCatch } from 'src/common/try-catch.decorator';

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCommentDto, userId: string): Promise<Comment> {
    const { content, target_id, target_type, parent_comment_id } = dto;

    if (parent_comment_id != null) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: parent_comment_id },
        select: { id: true, target_id: true, target_type: true },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent comment ${parent_comment_id} not found.`,
        );
      }
      if (
        parent.target_id !== target_id ||
        parent.target_type !== target_type
      ) {
        throw new BadRequestException(
          `Cannot reply: parent belongs to a different target.`,
        );
      }
    }

    let owner_post_id = null;
    let post_title = null;

    if (target_type === TargetType.POST) {
      const post = await this.prisma.post.findUnique({
        where: { id: target_id },
      });
      if (!post) {
        throw new NotFoundException(`Post ${target_id} not found.`);
      }
      owner_post_id = post.user_id;
      post_title = post.title;
    } else if (target_type === TargetType.BLOG) {
      const blog = await this.prisma.blog.findUnique({
        where: { id: target_id },
      });
      if (!blog) {
        throw new NotFoundException(`Blog ${target_id} not found.`);
      }
    } else {
      throw new BadRequestException(`Invalid target_type: ${target_type}`);
    }

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const newComment = await tx.comment.create({
            data: {
              content,
              user_id: userId,
              target_id,
              target_type,
              parent_comment_id,
            },
            include: {
              user: {
                select: { id: true, username: true, profile_picture_url: true },
              },
              replies: {
                select: {
                  id: true,
                  content: true,
                  created_at: true,
                  like_count: true,
                  user: {
                    select: {
                      id: true,
                      username: true,
                      profile_picture_url: true,
                    },
                  },
                },
              },
            },
          });

          if (target_type === TargetType.POST) {
            await tx.post.update({
              where: { id: target_id },
              data: { comment_count: { increment: 1 } },
            });
            let userIsReplied = null;
            if (dto.parent_comment_id != null) {
              userIsReplied = await this.prisma.comment.findFirst({
                where: { parent_comment_id: dto.parent_comment_id },
                select: { user_id: true },
              });
            }

            // Only send notification if the user is not commenting on their own post
            const targetUserId =
              userIsReplied == null ? owner_post_id : userIsReplied.user_id;
            if (
              targetUserId &&
              NotificationUtils.shouldSendNotification(userId, targetUserId)
            ) {
              this.eventEmitter.emit('push-notification', {
                from: userId,
                to: targetUserId,
                type: 'artwork_commented',
                post: { title: post_title ? post_title : 'post' },
                comment: { text: dto.content },
                postId: target_id.toString(),
                commentId: newComment.id.toString(),
                postTitle: post_title ? post_title : 'post',
                createdAt: new Date(),
              });
            }
          } else {
            await tx.blog.update({
              where: { id: target_id },
              data: { comment_count: { increment: 1 } },
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
        target_id: targetId,
        target_type: targetType,
        parent_comment_id: parentCommentId ?? null,
      },
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, profile_picture_url: true },
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
          where: { user_id: currentUserId, comment_id: { in: ids } },
          select: { comment_id: true },
        })
      : [];
    const likedSet = new Set(likedRows.map((l) => l.comment_id));

    /* ❷ map every record to DTO, surfacing `reply_count` ---------- */
    return comments.map((commentPrisma): CommentDto => {
      const { _count: prismaCount, ...restOfCommentFields } = commentPrisma;

      return {
        ...restOfCommentFields,
        likedByCurrentUser: likedSet.has(commentPrisma.id),
        reply_count: prismaCount.replies,
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
      select: { id: true, user_id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Comment with ID ${commentId} not found.`);
    }

    if (existing.user_id !== userId) {
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
        user_id: true,
        target_id: true,
        target_type: true,
      },
    });
    if (!existing) {
      throw new NotFoundException(`Comment ${commentId} not found.`);
    }
    if (existing.user_id !== userId) {
      throw new ForbiddenException(`You cannot delete someone else's comment.`);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const deleteResult = await tx.comment.deleteMany({
          where: { parent_comment_id: commentId },
        });
        const repliesRemoved = deleteResult.count;
        await tx.comment.delete({ where: { id: commentId } });

        const totalToDecrement = 1 + repliesRemoved;
        if (existing.target_type === TargetType.POST) {
          await tx.post.update({
            where: { id: existing.target_id },
            data: { comment_count: { decrement: totalToDecrement } },
          });
        } else {
          await tx.blog.update({
            where: { id: existing.target_id },
            data: { comment_count: { decrement: totalToDecrement } },
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
        data: { user_id: userId, comment_id: commentId },
      });
      await tx.comment.update({
        where: { id: commentId },
        data: { like_count: { increment: 1 } },
      });
    });
  }

  async unlikeComment(userId: string, commentId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.commentLike.delete({
        where: {
          user_id_comment_id: { user_id: userId, comment_id: commentId },
        },
      });
      await tx.comment.update({
        where: { id: commentId },
        data: { like_count: { decrement: 1 } },
      });
    });
  }
}
