import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TryCatch } from 'src/common/try-catch.decorator';
import embeddingConfig from 'src/config/embedding.config';
import { QdrantService } from 'src/embedding/qdrant.service';
import { PrismaService } from 'src/prisma.service';
import { BlogEmbeddingService } from './blog-embedding.service';
import { CreateBlogDto } from './dto/request/create-blog.dto';
import { UpdateBlogDto } from './dto/request/update-blog.dto';
import { BlogDetailsResponseDto } from './dto/response/blog-details.dto';
import { BookmarkResponseDto } from './dto/response/bookmark-response.dto';
import { ProtectResponseDto } from './dto/response/protect-response.dto';
import { RatingResponseDto } from './dto/response/rating-response.dto';
import {
  BlogWithRelations,
  mapBlogToDetailsDto,
} from './helpers/blog-mapping.helper';

@Injectable()
export class BlogManagementService {
  private readonly blogsCollectionName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly blogEmbeddingService: BlogEmbeddingService,
    private readonly qdrantService: QdrantService,
    @Inject(embeddingConfig.KEY)
    private embeddingConf: ConfigType<typeof embeddingConfig>,
  ) {
    this.blogsCollectionName = this.embeddingConf.blogsCollectionName;
  }

  @TryCatch()
  async createBlog(
    createBlogDto: CreateBlogDto,
    userId: string,
  ): Promise<BlogDetailsResponseDto> {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const newBlog = await this.prisma.blog.create({
      data: {
        ...createBlogDto,
        userId: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profilePictureUrl: true,
            fullName: true,
            followersCount: true,
          },
        },
        likes: {
          // ✨ include to keep DTO happy
          select: { id: true },
          where: { userId: userId },
          take: 1,
        },
      },
    });

    const mappedBlog = mapBlogToDetailsDto(newBlog);
    if (!mappedBlog) {
      console.error(
        `Failed to map blog details after creation for blog ID: ${newBlog.id}.`,
      );
      throw new InternalServerErrorException(
        'Failed to process blog details after creation.',
      );
    }

    void this.blogEmbeddingService.upsertBlogEmbeddings(
      newBlog.id,
      newBlog.title,
      newBlog.content,
    );
    return mappedBlog;
  }

  async updateBlog(
    id: number,
    updateBlogDto: UpdateBlogDto,
    userId: string,
  ): Promise<BlogDetailsResponseDto> {
    const existingBlog = await this.prisma.blog.findUnique({
      where: { id },
    });

    if (!existingBlog) {
      throw new NotFoundException(`Blog with ID ${id} not found.`);
    }

    if (existingBlog.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this blog.',
      );
    }

    const updatedBlog: BlogWithRelations = await this.prisma.blog.update({
      where: { id },
      data: { ...updateBlogDto, updatedAt: new Date() },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profilePictureUrl: true,
            fullName: true,
            followersCount: true,
          },
        },
        likes: {
          where: { userId: userId ?? '' },
          select: { id: true },
          take: 1,
        },
      },
    });

    const mappedBlog = mapBlogToDetailsDto(updatedBlog);
    if (!mappedBlog) {
      console.error(
        `Failed to map blog details after update for blog ID: ${updatedBlog.id}.`,
      );
      throw new InternalServerErrorException(
        'Failed to process blog details after update.',
      );
    }

    void this.blogEmbeddingService.updateBlogEmbeddings(
      updatedBlog.id,
      updateBlogDto.title === existingBlog.title
        ? undefined
        : updateBlogDto.title,
      updateBlogDto.content === existingBlog.content
        ? undefined
        : updatedBlog.content,
    );

    return mappedBlog;
  }

  async deleteBlog(id: number) {
    const result = await this.prisma.blog.delete({ where: { id } });

    // void this.qdrantService.deletePoints(this.blogsCollectionName, [id]);

    return result;
  }

  async deleteManyBlogs(blogIds: number[]) {
    const deleted_blogs = await this.prisma.blog.deleteMany({
      where: {
        id: { in: blogIds },
      },
    });
    console.log(`deleted_blogs: ${deleted_blogs.count}`)
    // void this.qdrantService.deletePoints(this.blogsCollectionName, blogIds);

    return deleted_blogs;
  }

  async toggleBookmark(
    blogId: number,
    userId: string,
  ): Promise<BookmarkResponseDto> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      select: {
        id: true,
        isPublished: true,
        isProtected: true,
        userId: true,
      },
    });
    if (
      !blog ||
      (!blog.isPublished && blog.userId !== userId) ||
      (blog.isProtected && blog.userId !== userId)
    ) {
      throw new NotFoundException(
        `Blog with ID ${blogId} not found or not accessible.`,
      );
    }

    const existingBookmark = await this.prisma.bookmark.findUnique({
      where: { userId_blogId: { userId, blogId } },
    });

    if (existingBookmark) {
      await this.prisma.bookmark.delete({
        where: { userId_blogId: { userId, blogId } },
      });

      return { bookmarked: false, blogId };
    } else {
      await this.prisma.bookmark.create({
        data: { userId, blogId },
      });

      return { bookmarked: true, blogId };
    }
  }

  async protectBlog(
    blogId: number,
    userId: string,
  ): Promise<ProtectResponseDto> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      select: { userId: true, isProtected: true },
    });
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${blogId} not found.`);
    }
    if (blog.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this blog.',
      );
    }

    const newProtectionStatus = !blog.isProtected;
    await this.prisma.blog.update({
      where: { id: blogId },
      data: { isProtected: newProtectionStatus },
    });

    return {
      blogId: blogId,
      protectionStatus: newProtectionStatus ? 'protected' : 'unprotected',
    };
  }

  async rateBlog(
    blogId: number,
    userId: string,
    ratingValue: number,
  ): Promise<RatingResponseDto> {
    if (ratingValue < 1 || ratingValue > 5) {
      throw new ForbiddenException('Rating must be between 1 and 5.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const blog = await tx.blog.findUnique({
        where: { id: blogId },
        select: { id: true, userId: true },
      });

      if (!blog) {
        throw new NotFoundException(`Blog with ID ${blogId} not found.`);
      }

      if (blog.userId === userId) {
        throw new ForbiddenException('You cannot rate your own blog.');
      }

      await tx.rating.upsert({
        where: { userId_blogId: { userId, blogId } },
        update: { value: ratingValue },
        create: { userId, blogId, value: ratingValue },
      });

      const aggregateResult = await tx.rating.aggregate({
        where: { blogId: blogId },
        _avg: { value: true },
        _count: { value: true },
      });

      const newAverage = aggregateResult._avg.value ?? 0;
      const newCount = aggregateResult._count.value ?? 0;

      await tx.blog.update({
        where: { id: blogId },
        data: {
          averageRating: newAverage,
          ratingCount: newCount,
        },
      });

      return { newAverageRating: newAverage, userRating: ratingValue };
    });

    return {
      blogId: blogId,
      newAverageRating: result.newAverageRating,
      userRating: result.userRating,
    };
  }
}
