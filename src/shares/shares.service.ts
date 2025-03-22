import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateShareDto } from './dto/create-share.dto';
import { TargetType } from '@prisma/client';
import { RemoveShareDto } from './dto/remove-share.dto';

@Injectable()
export class SharesService {
  constructor(private readonly prisma: PrismaService) {}

  // CREATE a new share and increment the share_count if target is a post
  async createShare(dto: CreateShareDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create the share record
      const share = await tx.share.create({
        data: {
          user_id: userId,
          target_id: dto.target_id,
          target_type: dto.target_type,
          share_platform: dto.share_platform,
        },
      });

      // 2. If the target is a POST, increment share_count in the Post table
      if (dto.target_type === TargetType.POST) {
        await tx.post.update({
          where: { id: dto.target_id },
          data: { share_count: { increment: 1 } },
        });
      }
      // If you have a Blog model with share_count, handle that here:
      // else if (dto.target_type === TargetType.BLOG) { ... }

      return share;
    });
  }

  // (OPTIONAL) REMOVE a share and decrement the share_count
  async removeShare(dto: RemoveShareDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete the share record
      await tx.share.deleteMany({
        where: {
          user_id: userId,
          target_id: dto.target_id,
          target_type: dto.target_type,
        },
      });

      // 2. Decrement the share_count if the target is a POST
      if (dto.target_type === TargetType.POST) {
        await tx.post.update({
          where: { id: dto.target_id },
          data: { share_count: { decrement: 1 } },
        });
      }
      // else if (dto.target_type === TargetType.BLOG) { ... }

      return { message: 'Share removed successfully' };
    });
  }
}
