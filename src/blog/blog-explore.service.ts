import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import {
  generatePaginatedResponse,
  generatePaginatedResponseWithUnknownTotal,
} from 'src/common/helpers/pagination.helper';
import { TryCatch } from 'src/common/try-catch.decorator';
import embeddingConfig from 'src/config/embedding.config';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { GetBlogsQueryDto } from './dto/request/get-blogs-query.dto';
import { BlogDetailsResponseDto } from './dto/response/blog-details.dto';
import { BlogListItemResponseDto } from './dto/response/blog-list-item.dto';
import {
  BlogForListItemPayload,
  blogListItemSelect,
  mapBlogToDetailsDto,
  mapBlogToListItemDto,
} from './helpers/blog-mapping.helper';

@Injectable()
export class BlogExploreService {
  private readonly blogsCollectionName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantClient: QdrantClient,
    @Inject(embeddingConfig.KEY)
    private embeddingConf: ConfigType<typeof embeddingConfig>,
  ) {
    this.blogsCollectionName = this.embeddingConf.blogsCollectionName;
  }

  private async applyCommonBlogFilters(
    baseWhere: Prisma.BlogWhereInput,
    requestingUserId?: string | null,
    categories?: string[] | null,
  ): Promise<Prisma.BlogWhereInput> {
    const whereClause = { ...baseWhere };

    if (categories && categories.length > 0) {
      whereClause.categories = {
        some: {
          name: {
            in: categories,
            mode: 'insensitive',
          },
        },
      };
    }

    return whereClause;
  }

  @TryCatch()
  async getBlogs(
    queryDto: GetBlogsQueryDto,
  ): Promise<PaginatedResponse<BlogListItemResponseDto>> {
    const { page = 1, limit = 10, search } = queryDto;

    const whereClause: Prisma.BlogWhereInput = {
      is_published: true,
      is_protected: false,
    };

    if (search) {
      return await this.getBlogsByQueryEmbedding(search, page, limit);
    }

    const [blogs, totalBlogs] = await this.prisma.$transaction([
      this.prisma.blog.findMany({
        where: whereClause,
        select: blogListItemSelect,
        orderBy: [{ created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blog.count({
        where: whereClause,
      }),
    ]);

    const mappedBlogs = blogs
      .map(mapBlogToListItemDto)
      .filter((b): b is BlogListItemResponseDto => b !== null);

    return generatePaginatedResponse(mappedBlogs, totalBlogs, {
      page,
      limit,
    });
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

  async findBlogById(
    id: number,
    requestingUserId?: string | null,
  ): Promise<BlogDetailsResponseDto | null> {
    // Single query that gets all needed data for both existence and access checks
    const blog = await this.prisma.blog.findUnique({
      where: { id },
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
          where: { user_id: requestingUserId ?? '' },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!blog) {
      return null; // Blog doesn't exist
    }

    const isOwner = blog.user_id === requestingUserId;

    // Apply access control rules using the same blog object
    if (!blog.is_published && !isOwner) {
      return null; // Unpublished blog, not accessible to non-owners
    }

    if (blog.is_protected && !isOwner) {
      return null; // Protected blog, not accessible to non-owners
    }

    // Increment view count for accessible blogs
    await this.prisma.blog.update({
      where: { id },
      data: { view_count: { increment: 1 } },
    });

    return mapBlogToDetailsDto(blog);
  }
  async checkBlogAccess(
    id: number,
    requestingUserId?: string | null,
  ): Promise<{
    exists: boolean;
    accessible: boolean;
    reason?: 'not_found' | 'not_published' | 'protected';
    isOwner?: boolean;
  }> {
    // Use select instead of include for minimal data fetch
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      select: {
        id: true,
        is_published: true,
        is_protected: true,
        user_id: true,
      },
    });

    if (!blog) {
      return { exists: false, accessible: false, reason: 'not_found' };
    }

    const isOwner = blog.user_id === requestingUserId;

    if (!blog.is_published && !isOwner) {
      return {
        exists: true,
        accessible: false,
        reason: 'not_published',
        isOwner,
      };
    }

    if (blog.is_protected && !isOwner) {
      return {
        exists: true,
        accessible: false,
        reason: 'protected',
        isOwner,
      };
    }

    return { exists: true, accessible: true, isOwner };
  }

  async getTrendingBlogs(
    queryDto: GetBlogsQueryDto,
    requestingUserId?: string | null,
  ): Promise<PaginatedResponse<BlogListItemResponseDto>> {
    const { page = 1, limit = 10, categories } = queryDto;
    const baseWhere: Prisma.BlogWhereInput = {
      is_published: true,
      is_protected: false,
    };

    const finalWhere = await this.applyCommonBlogFilters(
      baseWhere,
      requestingUserId,
      categories,
    );

    const [blogs, totalBlogs] = await this.prisma.$transaction([
      this.prisma.blog.findMany({
        where: finalWhere,
        select: blogListItemSelect,
        orderBy: [
          { like_count: 'desc' },
          { comment_count: 'desc' },
          { created_at: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blog.count({
        where: finalWhere,
      }),
    ]);

    const mappedBlogs = blogs
      .map(mapBlogToListItemDto)
      .filter((b): b is BlogListItemResponseDto => b !== null);

    return generatePaginatedResponse(mappedBlogs, totalBlogs, {
      page,
      limit,
    });
  }

  async getFollowingBlogs(
    queryDto: GetBlogsQueryDto,
    userId: string,
  ): Promise<PaginatedResponse<BlogListItemResponseDto>> {
    const { page = 1, limit = 10, categories } = queryDto;
    const followedUsers = await this.prisma.follow.findMany({
      where: { follower_id: userId },
      select: { following_id: true },
    });
    const followedUserIds = followedUsers.map((f) => f.following_id);

    if (followedUserIds.length === 0)
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNextPage: false,
      };

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

    const [blogs, totalBlogs] = await this.prisma.$transaction([
      this.prisma.blog.findMany({
        where: finalWhere,
        select: blogListItemSelect,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blog.count({
        where: finalWhere,
      }),
    ]);
    const mappedBlogs = blogs
      .map(mapBlogToListItemDto)
      .filter((b): b is BlogListItemResponseDto => b !== null);

    return generatePaginatedResponse(mappedBlogs, totalBlogs, {
      page,
      limit,
    });
  }

  async getBlogsByUsername(
    username: string,
    take: number,
    skip: number,
  ): Promise<BlogListItemResponseDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User with username ${username} not found.`);
    }

    const blogs: BlogForListItemPayload[] = await this.prisma.blog.findMany({
      where: { user_id: user.id },
      select: blogListItemSelect,
      orderBy: { created_at: 'desc' },
      take: take,
      skip: skip,
    });

    return blogs
      .map(mapBlogToListItemDto)
      .filter((b): b is BlogListItemResponseDto => b !== null);
  }

  @TryCatch()
  async getRelevantBlogs(
    blogId: number,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<BlogListItemResponseDto>> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
    });
    if (!blog) {
      throw new NotFoundException(`Blog with ID ${blogId} not found.`);
    }

    const relevantQueryText = blog.title + ' ' + blog.content;

    const result = await this.getBlogsByQueryEmbedding(
      relevantQueryText,
      page,
      limit,
    );

    // filter out the current blog from results
    const filteredBlogs = result.data.filter((b) => b.id !== blogId);
    return generatePaginatedResponseWithUnknownTotal(filteredBlogs, {
      page: result.page,
      limit: result.limit,
    });
  }

  private async getBlogsByQueryEmbedding(
    searchQuery: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<BlogListItemResponseDto>> {
    const queryEmbedding =
      await this.embeddingService.generateEmbeddingFromText(searchQuery);

    const searchResponse = await this.qdrantClient.query(
      this.blogsCollectionName,
      {
        prefetch: [
          {
            query: queryEmbedding,
            using: 'title',
          },
          {
            query: queryEmbedding,
            using: 'content',
          },
        ],
        query: {
          fusion: 'dbsf',
        },

        offset: (page - 1) * limit,
        // get extra since we can't have exact total count
        limit: limit + 1, // +1 to check if there's a next page
      },
    );

    const pointIds: number[] = searchResponse.points.map((point) =>
      Number(point.id),
    );

    const blogs: BlogForListItemPayload[] = await this.prisma.blog.findMany({
      where: { id: { in: pointIds } },
      select: blogListItemSelect,
    });

    const sortedBlogs: BlogForListItemPayload[] = pointIds
      .map((id) => blogs.find((blog) => blog.id === id))
      .filter((blog) => blog !== undefined);

    const mappedBlogs = sortedBlogs
      .map(mapBlogToListItemDto)
      .filter((b): b is BlogListItemResponseDto => b !== null);

    return generatePaginatedResponseWithUnknownTotal(mappedBlogs, {
      page,
      limit,
    });
  }
}
