import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateLikeDto } from './dto/request/create-like.dto';
import { TargetType } from '@prisma/client';
import { plainToClass } from 'class-transformer';
import { LikeDetailsDto } from './dto/response/like-details.dto';
import { RemoveLikeDto } from './dto/request/remove-like.dto';

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  async createLike(
    createLikeDto: CreateLikeDto,
    userId: string,
  ): Promise<LikeDetailsDto> {
    await this.verifyTargetExists(
      createLikeDto.target_id,
      createLikeDto.target_type,
    );

    await this.verifyLikeAlreadyExists(createLikeDto, userId);

    const result = await this.prisma.$transaction(async (tx) => {
      const like = await tx.like.create({
        data: {
          user_id: userId,
          target_id: createLikeDto.target_id,
          target_type: createLikeDto.target_type,
        },
      });

      if (createLikeDto.target_type === TargetType.POST) {
        await tx.post.update({
          where: { id: createLikeDto.target_id },
          data: { like_count: { increment: 1 } },
        });
      } else if (createLikeDto.target_type === TargetType.BLOG) {
        // TODO: will un comment this when blog model is created
        // For blogs, assuming you have a Blog model with like_count
        // await tx.blog.update({
        //   where: { id: createLikeDto.target_id },
        //   data: { like_count: { increment: 1 } },
        // });
      }
      return like;
    });

    return plainToClass(LikeDetailsDto, result);
  }

  private async verifyTargetExists(targetId: number, targetType: TargetType) {
    if (targetType === TargetType.POST) {
      const post = await this.prisma.post.findUnique({
        where: { id: targetId },
      });
      if (!post) {
        throw new BadRequestException('Post not found');
      }
    } else if (targetType === TargetType.BLOG) {
      // TODO: will un comment this when blog model is created
      // const blog = await this.prisma.blog.findUnique({ where: { id: targetId } });
      // if (!blog) {
      //   throw new BadRequestException('Blog not found');
      // }
    }
  }

  private async verifyLikeAlreadyExists(
    createLikeDto: CreateLikeDto,
    userId: string,
  ) {
    const existingLike = await this.findLike(
      createLikeDto.target_id,
      createLikeDto.target_type,
      userId,
    );
    if (existingLike) {
      throw new BadRequestException('You have already liked this target');
    }
  }

  private async verifyLikeNotExists(
    removeLikeDto: RemoveLikeDto,
    userId: string,
  ) {
    const existingLike = await this.findLike(
      removeLikeDto.target_id,
      removeLikeDto.target_type,
      userId,
    );

    if (!existingLike) {
      throw new BadRequestException(
        "Can't remove because you have not liked this target",
      );
    }
  }

  private async findLike(
    target_id: number,
    target_type: TargetType,
    userId: string,
  ) {
    return this.prisma.like.findFirst({
      where: {
        user_id: userId,
        target_id,
        target_type,
      },
    });
  }

  async removeLike(createLikeDto: RemoveLikeDto, userId: string) {
    await this.verifyTargetExists(
      createLikeDto.target_id,
      createLikeDto.target_type,
    );

    await this.verifyLikeNotExists(createLikeDto, userId);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.like.deleteMany({
        where: {
          user_id: userId,
          target_id: createLikeDto.target_id,
          target_type: createLikeDto.target_type,
        },
      });

      if (createLikeDto.target_type === TargetType.POST) {
        await tx.post.update({
          where: { id: createLikeDto.target_id },
          data: { like_count: { decrement: 1 } },
        });
      } else if (createLikeDto.target_type === TargetType.BLOG) {
        // TODO: will un comment this when blog model is created
        // await tx.blog.update({
        //   where: { id: createLikeDto.target_id },
        //   data: { like_count: { decrement: 1 } },
        // });
      }
    });
    return result;
  }
}
