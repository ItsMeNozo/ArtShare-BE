import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateBlogDto } from './dto/request/create-blog.dto';
import { UpdateBlogDto } from './dto/request/update-blog.dto';
import { BlogListItemResponseDto } from './dto/response/blog-list-item.dto';
import { BlogDetailsResponseDto } from './dto/response/blog-details.dto';
import {
  mapBlogToListItemDto,
  mapBlogToDetailsDto,
  BlogForListItemPayload,
  BlogWithUser,
  blogListItemSelect,
} from './helpers/blog-mapping.helper';
import { BookmarkResponseDto } from './dto/response/bookmark-response.dto';
import { ProtectResponseDto } from './dto/response/protect-response.dto';
import { RatingResponseDto } from './dto/response/rating-response.dto';

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  private async applyCommonBlogFilters(
    baseWhere: Prisma.BlogWhereInput,
    requestingUserId?: string | null,
    categories?: string[] | null,
  ): Promise<Prisma.BlogWhereInput> {
    const whereClause = { ...baseWhere };

    if (categories && categories.length > 0) {
      whereClause.categories = {
        some: {
          cate_name: {
            in: categories,
            mode: 'insensitive',
          },
        },
      };
    }

    return whereClause;
  }

  async getBlogs(
    take: number,
    skip: number,
    search?: string,
  ): Promise<BlogListItemResponseDto[]> {
    const whereClause: Prisma.BlogWhereInput = {
      is_published: true,
      is_protected: false,
    };

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const blogs: BlogForListItemPayload[] = await this.prisma.blog.findMany({
      where: whereClause,
      select: blogListItemSelect,
      orderBy: [{ created_at: 'desc' }],
      take: take,
      skip: skip,
    });

    return blogs
      .map(mapBlogToListItemDto)
      .filter((b): b is BlogListItemResponseDto => b !== null);
  }

  async findMyBlogs(userId: string): Promise<BlogListItemResponseDto[]> {
    const blogs: BlogForListItemPayload[] = await this.prisma.blog.findMany({
      where: { user_id: userId },
      select: blogListItemSelect,
      orderBy: { created_at: 'desc' },
    });
    return blogs
      .map(mapBlogToListItemDto)
      .filter((b): b is BlogListItemResponseDto => b !== null);
  }

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
          select: { id: true, username: true, profile_picture_url: true },
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
    return mappedBlog;
  }

  async findBlogById(
    id: number,
    requestingUserId?: string | null,
  ): Promise<BlogDetailsResponseDto | null> {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, profile_picture_url: true },
        },
      },
    });

    if (!blog) return null;

    if (blog.is_protected && blog.user_id !== requestingUserId) {
      return null;
    }
    if (!blog.is_published && blog.user_id !== requestingUserId) {
      return null;
    }

    return mapBlogToDetailsDto(blog);
  }

  async updateBlog(
    id: number,
    updateBlogDto: UpdateBlogDto,
    userId: string,
  ): Promise<BlogDetailsResponseDto> {
    const existingBlog = await this.prisma.blog.findUnique({
      where: { id },
      select: { user_id: true },
    });
    if (!existingBlog) {
      throw new NotFoundException(`Blog with ID ${id} not found.`);
    }
    if (existingBlog.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this blog.',
      );
    }

    const updatedBlog: BlogWithUser = await this.prisma.blog.update({
      where: { id },
      data: { ...updateBlogDto, updated_at: new Date() },
      include: {
        user: {
          select: { id: true, username: true, profile_picture_url: true },
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
    return mappedBlog;
  }

  async deleteBlog(id: number, userId: string): Promise<void> {
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
    await this.prisma.blog.delete({ where: { id } });
  }

  async getTrendingBlogs(
    take: number,
    skip: number,
    categories?: string[],
    requestingUserId?: string | null,
  ): Promise<BlogListItemResponseDto[]> {
    const baseWhere: Prisma.BlogWhereInput = {
      is_published: true,
      is_protected: false,
    };

    const finalWhere = await this.applyCommonBlogFilters(
      baseWhere,
      requestingUserId,
      categories,
    );

    const blogs: BlogForListItemPayload[] = await this.prisma.blog.findMany({
      where: finalWhere,
      select: blogListItemSelect,
      orderBy: [
        { like_count: 'desc' },
        { comment_count: 'desc' },
        { created_at: 'desc' },
      ],
      take: take,
      skip: skip,
    });
    return blogs
      .map(mapBlogToListItemDto)
      .filter((b): b is BlogListItemResponseDto => b !== null);
  }

  async getFollowingBlogs(
    userId: string,
    take: number,
    skip: number,
    categories?: string[],
  ): Promise<BlogListItemResponseDto[]> {
    const followedUsers = await this.prisma.follow.findMany({
      where: { follower_id: userId },
      select: { following_id: true },
    });
    const followedUserIds = followedUsers.map((f) => f.following_id);

    if (followedUserIds.length === 0) return [];

    const baseWhere: Prisma.BlogWhereInput = {
      user_id: { in: followedUserIds },
      is_published: true,
      is_protected: false,
    };

    const finalWhere = await this.applyCommonBlogFilters(
      baseWhere,
      null,
      categories,
    );

    const blogs: BlogForListItemPayload[] = await this.prisma.blog.findMany({
      where: finalWhere,
      select: blogListItemSelect,
      orderBy: { created_at: 'desc' },
      take: take,
      skip: skip,
    });
    return blogs
      .map(mapBlogToListItemDto)
      .filter((b): b is BlogListItemResponseDto => b !== null);
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
