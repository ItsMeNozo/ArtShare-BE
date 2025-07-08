import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { TargetType } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { CreateShareDto } from './dto/request/create-share.dto';
import { ShareDetailsDto } from './dto/response/share-details.dto';

@Injectable()
export class SharesService {
  constructor(private readonly prisma: PrismaService) {}

  async createShare(
    dto: CreateShareDto,
    userId: string,
  ): Promise<ShareDetailsDto> {
    await this.verifyTargetExists(dto.targetId, dto.targetType);
    await this.verifyShareAlreadyExists(dto, userId);

    const share = await this.prisma.$transaction(async (tx) => {
      const created = await tx.share.create({
        data: {
          userId: userId,
          sharePlatform: dto.sharePlatform,
          ...(dto.targetType === TargetType.POST
            ? { postId: dto.targetId }
            : { blogId: dto.targetId }),
        },
      });

      if (dto.targetType === TargetType.POST) {
        await tx.post.update({
          where: { id: dto.targetId },
          data: { shareCount: { increment: 1 } },
        });
      } else {
        await tx.blog.update({
          where: { id: dto.targetId },
          data: { shareCount: { increment: 1 } },
        });
      }

      return created;
    });

    return plainToClass(ShareDetailsDto, share);
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

  private async verifyShareAlreadyExists(dto: CreateShareDto, userId: string) {
    const existing = await this.findShare(dto.targetId, dto.targetType, userId);
    if (existing) throw new BadRequestException('You have already shared this');
  }

  private async findShare(
    targetId: number,
    targetType: TargetType,
    userId: string,
  ) {
    if (targetType === TargetType.POST) {
      return this.prisma.share.findFirst({
        where: { userId: userId, postId: targetId },
      });
    } else {
      return this.prisma.share.findFirst({
        where: { userId: userId, blogId: targetId },
      });
    }
  }
}
