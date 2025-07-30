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
import {
  BlogDateRange,
  BlogSortBy,
  BlogSortField,
  UserBlogsQueryDto,
} from './dto/request/user-blogs-query.dto';
import { BlogDetailsResponseDto } from './dto/response/blog-details.dto';
import { BlogListItemResponseDto } from './dto/response/blog-list-item.dto';
import {
  BlogForListItemPayload,
  blogListItemSelect,
  mapBlogToDetailsDto,
} from './helpers/blog-mapping.helper';

@Injectable()
export class BlogExploreService {
  private readonly blogsCollectionName: string;
  private readonly BLOG_VISIBILITY_FILTER = {
    isPublished: true,
    isProtected: false,
  };

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
      ...this.BLOG_VISIBILITY_FILTER,
    };

    if (search) {
      return await this.getBlogsByQueryEmbedding(search, page, limit);
    }

    const [blogs, totalBlogs] = await this.prisma.$transaction([
      this.prisma.blog.findMany({
        where: whereClause,
        select: blogListItemSelect,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blog.count({
        where: whereClause,
      }),
    ]);

    return generatePaginatedResponse(blogs, totalBlogs, {
      page,
      limit,
    });
  }

  async findMyBlogs(userId: string): Promise<BlogListItemResponseDto[]> {
    const blogs: BlogForListItemPayload[] = await this.prisma.blog.findMany({
      where: { userId: userId },
      select: blogListItemSelect,
      orderBy: { createdAt: 'desc' },
    });
    return blogs;
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
            profilePictureUrl: true,
            fullName: true,
            followersCount: true,
          },
        },
        likes: {
          where: { userId: requestingUserId ?? '' },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!blog) {
      return null; // Blog doesn't exist
    }

    const isOwner = blog.userId === requestingUserId;

    // Apply access control rules using the same blog object
    if (!blog.isPublished && !isOwner) {
      return null; // Unpublished blog, not accessible to non-owners
    }

    if (blog.isProtected && !isOwner) {
      return null; // Protected blog, not accessible to non-owners
    }

    // Increment view count for accessible blogs
    await this.prisma.blog.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
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
        isPublished: true,
        isProtected: true,
        userId: true,
      },
    });

    if (!blog) {
      return { exists: false, accessible: false, reason: 'not_found' };
    }

    const isOwner = blog.userId === requestingUserId;

    if (!blog.isPublished && !isOwner) {
      return {
        exists: true,
        accessible: false,
        reason: 'not_published',
        isOwner,
      };
    }

    if (blog.isProtected && !isOwner) {
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
      ...this.BLOG_VISIBILITY_FILTER,
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
          { likeCount: 'desc' },
          { commentCount: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blog.count({
        where: finalWhere,
      }),
    ]);

    return generatePaginatedResponse(blogs, totalBlogs, {
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
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followedUserIds = followedUsers.map((f) => f.followingId);

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
      userId: { in: followedUserIds },
      ...this.BLOG_VISIBILITY_FILTER,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.blog.count({
        where: finalWhere,
      }),
    ]);

    return generatePaginatedResponse(blogs, totalBlogs, {
      page,
      limit,
    });
  }

  async getBlogsByUsername(
    username: string,
    query: UserBlogsQueryDto,
  ): Promise<BlogListItemResponseDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User with username ${username} not found.`);
    }

    // Date range filter
    const dateFilter: any = {};
    const now = new Date();
    if (query.dateRange === BlogDateRange.LAST_7_DAYS) {
      dateFilter[query.sortField || BlogSortField.CREATED_AT] = {
        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      };
    } else if (query.dateRange === BlogDateRange.LAST_30_DAYS) {
      dateFilter[query.sortField || BlogSortField.CREATED_AT] = {
        gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      };
    }

    // Sorting
    const orderBy: any = {};
    const sortField = query.sortField || BlogSortField.CREATED_AT;
    orderBy[sortField] = query.sortBy === BlogSortBy.OLDEST ? 'asc' : 'desc';

    const blogs: BlogForListItemPayload[] = await this.prisma.blog.findMany({
      where: {
        userId: user.id,
        ...dateFilter,
      },
      select: blogListItemSelect,
      orderBy,
      take: query.take,
      skip: query.skip,
    });

    return blogs;
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
      where: { id: { in: pointIds }, ...this.BLOG_VISIBILITY_FILTER },
      select: blogListItemSelect,
    });

    const sortedBlogs: BlogForListItemPayload[] = pointIds
      .map((id) => blogs.find((blog) => blog.id === id))
      .filter((blog) => blog !== undefined);

    return generatePaginatedResponseWithUnknownTotal(sortedBlogs, {
      page,
      limit,
    });
  }
}
