import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateLikeDto } from './dto/create-like.dto';
import { TargetType } from '@prisma/client';

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  async createLike(createLikeDto: CreateLikeDto, userId: number) {
    // You can wrap this in a transaction to ensure both operations succeed or fail together.
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the like
      const like = await tx.like.create({
        data: {
          user_id: userId,
          target_id: createLikeDto.target_id,
          target_type: createLikeDto.target_type, // Either TargetType.POST or TargetType.BLOG
        },
      });

      // Update the like count if the target is a post
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

    return result;
  }

  async removeLike(createLikeDto: CreateLikeDto, userId: number) {
    // Remove a like and decrement the like count
    const result = await this.prisma.$transaction(async (tx) => {
      // Delete the like record
      await tx.like.deleteMany({
        where: {
          user_id: userId,
          target_id: createLikeDto.target_id,
          target_type: createLikeDto.target_type,
        },
      });

      // Decrement the like count if the target is a post
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
