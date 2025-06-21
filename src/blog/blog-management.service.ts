import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateBlogDto } from './dto/request/create-blog.dto';
import { UpdateBlogDto } from './dto/request/update-blog.dto';
import { BlogDetailsResponseDto } from './dto/response/blog-details.dto';
import {
  mapBlogToDetailsDto,
  BlogWithRelations,
} from './helpers/blog-mapping.helper';
import { BookmarkResponseDto } from './dto/response/bookmark-response.dto';
import { ProtectResponseDto } from './dto/response/protect-response.dto';
import { RatingResponseDto } from './dto/response/rating-response.dto';
import { TryCatch } from 'src/common/try-catch.decorator';
import { BlogEmbeddingService } from './blog-embedding.service';
import { QdrantService } from 'src/embedding/qdrant.service';
import { blogsCollectionName } from 'src/embedding/embedding.utils';

@Injectable()
export class BlogManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blogEmbeddingService: BlogEmbeddingService,
    private readonly qdrantService: QdrantService,
  ) {}

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
        user_id: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile_picture_url: true,
            full_name: true,
            followers_count: true,
          },
        },
        likes: {
          // ✨ include to keep DTO happy
          select: { id: true },
          where: { user_id: userId },
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
    if (existingBlog.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this blog.',
      );
    }

    const updatedBlog: BlogWithRelations = await this.prisma.blog.update({
      where: { id },
      data: { ...updateBlogDto, updated_at: new Date() },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile_picture_url: true,
            full_name: true,
            followers_count: true,
          },
        },
        likes: {
          where: { user_id: userId ?? '' },
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

  async deleteBlog(id: number, userId: string) {
    const existingBlog = await this.prisma.blog.findUnique({
      where: { id },
      select: { user_id: true },
    });
    if (!existingBlog) {
      throw new NotFoundException(`Blog with ID ${id} not found.`);
    }
    if (existingBlog.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this blog.',
      );
    }

    const result = await this.prisma.blog.delete({ where: { id } });

    void this.qdrantService.deletePoints(blogsCollectionName, [id]);

    return result;
  }

  async toggleBookmark(
    blogId: number,
    userId: string,
  ): Promise<BookmarkResponseDto> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      select: {
        id: true,
        is_published: true,
        is_protected: true,
        user_id: true,
      },
    });
    if (
      !blog ||
      (!blog.is_published && blog.user_id !== userId) ||
      (blog.is_protected && blog.user_id !== userId)
    ) {
      throw new NotFoundException(
        `Blog with ID ${blogId} not found or not accessible.`,
      );
    }

    const existingBookmark = await this.prisma.bookmark.findUnique({
      where: { user_id_blog_id: { user_id: userId, blog_id: blogId } },
    });

    if (existingBookmark) {
      await this.prisma.bookmark.delete({
        where: { user_id_blog_id: { user_id: userId, blog_id: blogId } },
      });

      return { bookmarked: false, blogId: blogId };
    } else {
      await this.prisma.bookmark.create({
        data: { user_id: userId, blog_id: blogId },
      });

      return { bookmarked: true, blogId: blogId };
    }
  }

  async protectBlog(
    blogId: number,
    userId: string,
  ): Promise<ProtectResponseDto> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      select: { user_id: true, is_protected: true },
    });
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${blogId} not found.`);
    }
    if (blog.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this blog.',
      );
    }

    const newProtectionStatus = !blog.is_protected;
    await this.prisma.blog.update({
      where: { id: blogId },
      data: { is_protected: newProtectionStatus },
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
        select: { id: true, user_id: true },
      });

      if (!blog) {
        throw new NotFoundException(`Blog with ID ${blogId} not found.`);
      }

      if (blog.user_id === userId) {
        throw new ForbiddenException('You cannot rate your own blog.');
      }

      await tx.rating.upsert({
        where: { user_id_blog_id: { user_id: userId, blog_id: blogId } },
        update: { value: ratingValue },
        create: { user_id: userId, blog_id: blogId, value: ratingValue },
      });

      const aggregateResult = await tx.rating.aggregate({
        where: { blog_id: blogId },
        _avg: { value: true },
        _count: { value: true },
      });

      const newAverage = aggregateResult._avg.value ?? 0;
      const newCount = aggregateResult._count.value ?? 0;

      await tx.blog.update({
        where: { id: blogId },
        data: {
          average_rating: newAverage,
          rating_count: newCount,
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
