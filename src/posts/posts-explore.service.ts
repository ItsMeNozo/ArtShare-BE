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
import { Post, Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { GetPostsDto } from './dto/request/get-posts.dto';
import { SearchPostDto } from './dto/request/search-post.dto';
import { PostDetailsResponseDto } from './dto/response/post-details.dto';
import { PostListItemResponse } from './dto/response/post-list-item.dto';
import {
  mapPostListToDto,
  mapPostToDetailViewDto,
  mapPostToDto,
  postItemSelect,
  PostWithRelations,
} from './mapper/posts-explore.mapper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PostDetailForViewDto } from './dto/response/post-details-view.dto';

@Injectable()
export class PostsExploreService {
  private readonly postsCollectionName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantClient: QdrantClient,
    @Inject(embeddingConfig.KEY)
    private embeddingConf: ConfigType<typeof embeddingConfig>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.postsCollectionName = this.embeddingConf.postsCollectionName;
  }

  @TryCatch()
  async getForYouPosts(
    userId: string,
    query: GetPostsDto,
  ): Promise<PaginatedResponse<PostListItemResponse>> {
    const { page = 1, limit = 25, filter = [], isAi } = query;

    const whereClause: Prisma.PostWhereInput =
      filter && filter.length > 0
        ? { categories: { some: { name: { in: filter } } } }
        : {};

    if (isAi && isAi === true) {
      whereClause.aiCreated = true;
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: whereClause,
        orderBy: [{ shareCount: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: (page - 1) * limit,
        include: this.buildPostIncludes(userId),
      }),
      this.prisma.post.count({
        where: whereClause,
      }),
    ]);

    const mappedPosts = mapPostListToDto(posts);

    return generatePaginatedResponse(mappedPosts, total, {
      page,
      limit,
    });
  }

  @TryCatch()
  async getTrendingPosts(
    userId: string,
    query: GetPostsDto,
  ): Promise<PaginatedResponse<PostListItemResponse>> {
    const { page = 1, limit = 25, filter = [], isAi } = query;

    const whereClause: Prisma.PostWhereInput =
      filter && filter.length > 0
        ? { categories: { some: { name: { in: filter } } } }
        : {};

    if (isAi && isAi === true) {
      whereClause.aiCreated = true;
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: whereClause,
        orderBy: [{ shareCount: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: (page - 1) * limit,
        include: this.buildPostIncludes(userId),
      }),
      this.prisma.post.count({
        where: whereClause,
      }),
    ]);

    const mappedPosts = mapPostListToDto(posts);

    return generatePaginatedResponse(mappedPosts, total, {
      page,
      limit,
    });
  }

  async getFollowingPosts(
    userId: string,
    query: GetPostsDto,
  ): Promise<PaginatedResponse<PostListItemResponse>> {
    const { page = 1, limit = 24, filter = [] } = query;
    const followingUsers = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = followingUsers.map((follow) => follow.followingId);

    const skip = (page - 1) * limit;

    const whereClause = {
      userId: { in: followingIds },
      ...(filter &&
        filter.length > 0 && {
          categories: { some: { name: { in: filter } } },
        }),
    };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: this.buildPostIncludes(userId),
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.post.count({
        where: whereClause,
      }),
    ]);

    const mappedPosts = mapPostListToDto(posts);

    return generatePaginatedResponse(mappedPosts, total, {
      page,
      limit,
    });
  }

  @TryCatch()
  async getPostDetails(
    postId: number,
    userId: string,
  ): Promise<PostDetailsResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: this.buildPostIncludes(userId),
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // update the view count
    this.eventEmitter.emitAsync('post.viewed', {
      postId: postId,
    });

    return mapPostToDto(post);
  }

  @TryCatch()
  async getPostDetailsForView(
    postId: number,
    userId: string,
  ): Promise<PostDetailForViewDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: this.buildPostIncludesForViewDetails(userId),
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // update the view count
    this.eventEmitter.emitAsync('post.viewed', {
      postId: postId,
    });

    return mapPostToDetailViewDto(post);
  }

  @TryCatch()
  async findPostsByUsername(
    username: string,
    page: number,
    pageSize: number,
    userId: string = '',
  ): Promise<PostListItemResponse[]> {
    const user = await this.prisma.user.findUnique({
      where: { username: username },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const skip = (page - 1) * pageSize;

    const posts = await this.prisma.post.findMany({
      where: { userId: user.id },
      skip,
      take: pageSize,
      include: this.buildPostIncludes(userId),
      orderBy: {
        createdAt: 'desc',
      },
    });

    return mapPostListToDto(posts);
  }

  @TryCatch()
  async searchPosts(
    body: SearchPostDto,
    userId: string,
  ): Promise<PaginatedResponse<PostListItemResponse>> {
    const { q, page = 1, limit = 25, filter, isAi } = body;

    const queryEmbedding =
      await this.embeddingService.generateEmbeddingFromText(q);
    const searchResponse = await this.qdrantClient.query(
      this.postsCollectionName,
      {
        prefetch: [
          {
            query: queryEmbedding,
            using: 'images',
          },
          {
            query: queryEmbedding,
            using: 'description',
            limit: 1,
          },
          {
            query: queryEmbedding,
            using: 'title',
            limit: 1,
          },
        ],
        query: {
          fusion: 'dbsf',
        },
        // query: queryEmbedding,
        // using: 'images',
        offset: (page - 1) * limit,
        limit: limit + 1, // +1 to check if there's a next page
        // with_payload: true,
        score_threshold: 0.54,
      },
    );

    const pointIds: number[] = searchResponse.points
      .map((point) => Number(point.id))
      .filter((pointId) => !isNaN(pointId));

    let whereClause: Prisma.PostWhereInput = {
      id: { in: pointIds },
    };
    if (filter && filter.length > 0) {
      whereClause = {
        ...whereClause,
        categories: { some: { name: { in: filter } } },
      };
    }

    if (isAi && isAi === true) {
      whereClause.aiCreated = true;
    }

    const posts: PostWithRelations[] = await this.prisma.post.findMany({
      where: whereClause,
      include: this.buildPostIncludes(userId),
    });

    // Sort posts in the same order as returned by Qdrant
    const sortedPosts: PostWithRelations[] = pointIds
      .map((id) => posts.find((post: PostWithRelations) => post.id === id))
      .filter((post): post is PostWithRelations => post !== undefined);

    const mappedPosts = mapPostListToDto(sortedPosts);

    return generatePaginatedResponseWithUnknownTotal(mappedPosts, {
      page,
      limit,
    });
  }

  @TryCatch()
  async getRelevantPosts(
    postId: number,
    page: number,
    pageSize: number,
    userId: string,
  ): Promise<PostListItemResponse[]> {
    const post: Post | null = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const relevantQueryText = post.title + ' ' + post.description;
    const queryEmbedding =
      await this.embeddingService.generateEmbeddingFromText(relevantQueryText);

    const searchResponse = await this.qdrantClient.query(
      this.postsCollectionName,
      {
        prefetch: [
          {
            query: queryEmbedding,
            using: 'images',
          },
          {
            query: queryEmbedding,
            using: 'description',
          },
          {
            query: queryEmbedding,
            using: 'title',
          },
        ],
        query: {
          fusion: 'dbsf',
        },
        offset: (page - 1) * pageSize,
        limit: pageSize,
      },
    );

    const pointIds: number[] = searchResponse.points
      .map((point) => Number(point.id))
      .filter((pointId) => !isNaN(pointId))
      .filter((pointId) => pointId !== postId);

    const posts: PostWithRelations[] = await this.prisma.post.findMany({
      where: { id: { in: pointIds } },
      include: this.buildPostIncludes(userId),
    });

    const sortedPosts = pointIds
      .map((id) => posts.find((post) => post.id === id))
      .filter((post) => post !== undefined);

    return mapPostListToDto(sortedPosts);
  }

  @TryCatch()
  async getAiTrendingPosts(
    page: number,
    pageSize: number,
  ): Promise<PostListItemResponse[]> {
    const skip = (page - 1) * pageSize;

    const customIncludes: Prisma.PostInclude = {
      artGeneration: true,
    };

    // 3. Merge them using spread syntax
    const finalIncludes: Prisma.PostInclude = {
      ...this.buildPostIncludes(''),
      ...customIncludes,
    };

    const posts = await this.prisma.post.findMany({
      where: { aiCreated: true },
      orderBy: [{ viewCount: 'desc' }, { shareCount: 'desc' }, { id: 'asc' }],
      take: pageSize,
      skip,
      // common includes with custom includes for art generation
      include: finalIncludes,
    });

    return mapPostListToDto(posts);
  }

  private buildPostIncludes = (userId: string): Prisma.PostInclude => {
    return {
      medias: true,
      user: true,
      categories: true,
      likes: {
        where: { userId: userId },
        take: 1,
        select: { id: true }, // only need existence
      },
    };
  };

  private buildPostIncludesForViewDetails = (
    userId: string,
  ): Prisma.PostInclude => {
    return {
      ...postItemSelect,
      medias: {
        select: {
          url: true,
          mediaType: true,
        },
      },
      user: {
        select: {
          username: true,
          fullName: true,
          profilePictureUrl: true,
        },
      },
      likes: {
        where: { userId: userId },
        take: 1,
        select: { id: true }, // only need existence
      },
    };
  };
}
