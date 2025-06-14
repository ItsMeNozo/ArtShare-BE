import { Injectable, NotFoundException } from '@nestjs/common';
import { PostListItemResponseDto } from './dto/response/post-list-item.dto';
import { TryCatch } from 'src/common/try-catch.decorator';
import { PrismaService } from 'src/prisma.service';
import { Post, Prisma } from '@prisma/client';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PostDetailsResponseDto } from './dto/response/post-details.dto';
import { SearchPostDto } from './dto/request/search-post.dto';
import {
  mapPostListToDto,
  mapPostToDto,
  PostWithRelations,
} from './mapper/posts-explore.mapper';
import { postsCollectionName } from 'src/embedding/embedding.utils';

@Injectable()
export class PostsExploreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantClient: QdrantClient,
  ) {}

  private buildPostIncludes = (userId: string): Prisma.PostInclude => {
    return {
      medias: true,
      user: true,
      categories: true,
      likes: {
        where: { user_id: userId },
        take: 1,
        select: { id: true }, // only need existence
      },
    };
  };

  @TryCatch()
  async getForYouPosts(
    userId: string,
    page: number,
    page_size: number,
    filter: string[],
  ): Promise<PostListItemResponseDto[]> {
    const skip = (page - 1) * page_size;

    const whereClause =
      filter && filter.length > 0
        ? { categories: { some: { name: { in: filter } } } }
        : {};

    const posts = await this.prisma.post.findMany({
      where: whereClause,
      orderBy: [{ share_count: 'desc' }, { id: 'desc' }],
      take: page_size,
      skip,
      include: this.buildPostIncludes(userId),
    });

    return mapPostListToDto(posts);
  }

  async getFollowingPosts(
    userId: string,
    page: number,
    page_size: number,
    filter: string[],
  ): Promise<PostListItemResponseDto[]> {
    const followingUsers = await this.prisma.follow.findMany({
      where: { follower_id: userId },
      select: { following_id: true },
    });

    const followingIds = followingUsers.map((follow) => follow.following_id);

    const skip = (page - 1) * page_size;

    const whereClause = {
      user_id: { in: followingIds },
      ...(filter &&
        filter.length > 0 && {
          categories: { some: { name: { in: filter } } },
        }),
    };

    const posts = await this.prisma.post.findMany({
      where: whereClause,
      skip,
      take: page_size,
      include: this.buildPostIncludes(userId),
      orderBy: {
        created_at: 'desc',
      },
    });

    return mapPostListToDto(posts);
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
    await this.prisma.post.update({
      where: { id: postId },
      data: { view_count: { increment: 1 } },
    });
    return mapPostToDto(post);
  }

  @TryCatch()
  async findPostsByUsername(
    username: string,
    page: number,
    page_size: number,
    userId: string = '',
  ): Promise<PostListItemResponseDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { username: username },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const skip = (page - 1) * page_size;

    const posts = await this.prisma.post.findMany({
      where: { user_id: user.id },
      skip,
      take: page_size,
      include: this.buildPostIncludes(userId),
      orderBy: {
        created_at: 'desc',
      },
    });

    return mapPostListToDto(posts);
  }

  @TryCatch()
  async searchPosts(
    body: SearchPostDto,
    userId: string,
  ): Promise<PostListItemResponseDto[]> {
    const { q, page = 1, page_size = 25, filter } = body;

    // const templatedQuery = `a photo of a ${q}`;

    const queryEmbedding =
      await this.embeddingService.generateEmbeddingFromText(q);
    const searchResponse = await this.qdrantClient.query(postsCollectionName, {
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
      offset: (page - 1) * page_size,
      limit: page_size,
      // with_payload: true,
      score_threshold: 0.54,
    });

    console.log('Search response for query:', q);
    console.dir(searchResponse, { depth: null });

    const pointIds: number[] = searchResponse.points
      .map((point) => Number(point.id))
      .filter((pointId) => !isNaN(pointId));

    const posts: PostWithRelations[] = await this.prisma.post.findMany({
      where: { id: { in: pointIds } },
      include: this.buildPostIncludes(userId),
    });

    // Sort posts in the same order as returned by Qdrant
    let sortedPosts: PostWithRelations[] = pointIds
      .map((id) => posts.find((post: PostWithRelations) => post.id === id))
      .filter((post): post is PostWithRelations => post !== undefined);

    if (filter && filter.length > 0) {
      sortedPosts = sortedPosts.filter((post) =>
        post.categories.some((category) => filter.includes(category.name)),
      );
    }
    return mapPostListToDto(sortedPosts);
  }

  @TryCatch()
  async getRelevantPosts(
    postId: number,
    page: number,
    page_size: number,
    userId: string,
  ): Promise<PostListItemResponseDto[]> {
    const post: Post | null = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const relevantQueryText = post.title + ' ' + post.description;
    const queryEmbedding =
      await this.embeddingService.generateEmbeddingFromText(relevantQueryText);

    const searchResponse = await this.qdrantClient.query(postsCollectionName, {
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
      offset: (page - 1) * page_size,
      limit: page_size,
    });

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
    page_size: number,
  ): Promise<PostListItemResponseDto[]> {
    const skip = (page - 1) * page_size;

    const customIncludes: Prisma.PostInclude = {
      art_generation: true,
    };

    // 3. Merge them using spread syntax
    const finalIncludes: Prisma.PostInclude = {
      ...this.buildPostIncludes(''),
      ...customIncludes,
    };

    const posts = await this.prisma.post.findMany({
      where: { ai_created: true },
      orderBy: [{ view_count: 'desc' }, { share_count: 'desc' }, { id: 'asc' }],
      take: page_size,
      skip,
      // common includes with custom includes for art generation
      include: finalIncludes,
    });

    return mapPostListToDto(posts);
  }
}
