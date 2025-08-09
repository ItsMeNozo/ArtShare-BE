// src/posts/utils/posts-query-builder.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PostsQueryBuilder {
  private static readonly VALID_SORT_FIELDS = new Set([
    'createdAt', 'title', 'viewCount', 'likeCount', 'commentCount', 'updatedAt'
  ]);
  
  private static readonly POST_SELECT_FIELDS = {
    id: true,
    title: true,
    description: true,
    thumbnailUrl: true,
    isPublished: true,
    isPrivate: true,
    aiCreated: true,
    viewCount: true,
    likeCount: true,
    commentCount: true,
    createdAt: true,
    updatedAt: true,
    user: { select: { id: true, username: true, profilePictureUrl: true } },
    categories: { select: { id: true, name: true } }
  };

  constructor(private prisma: PrismaService) {}

  buildWhereClause(filters: any): Prisma.PostWhereInput {
    const where: Prisma.PostWhereInput = {};
    
    if (filters?.search?.trim()) {
      const searchTerm = filters.search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { user: { username: { contains: searchTerm, mode: 'insensitive' } } }
      ];
    }
    
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.isPublished !== undefined) where.isPublished = filters.isPublished;
    if (filters?.isPrivate !== undefined) where.isPrivate = filters.isPrivate;
    if (filters?.aiCreated !== undefined) where.aiCreated = filters.aiCreated;
    if (filters?.categoryId) {
      where.categories = { some: { id: filters.categoryId } };
    }
    
    return where;
  }

  buildOrderBy(sortBy: string, sortOrder: string) {
    const field = PostsQueryBuilder.VALID_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    return { [field]: order };
  }

  getPostSelectFields() {
    return PostsQueryBuilder.POST_SELECT_FIELDS;
  }

  getAdminPostSelectFields() {
    return {
      id: true,
      userId: true,
      title: true,
      description: true,
      thumbnailUrl: true,
      isPublished: true,
      isPrivate: true,
      aiCreated: true,
      viewCount: true,
      likeCount: true,
      shareCount: true,
      commentCount: true,
      createdAt: true,
      user: { select: { id: true, username: true, profilePictureUrl: true } },
      categories: { select: { id: true, name: true, type: true } }
    };
  }

  async getOptimizedCount(where: Prisma.PostWhereInput, useApproximate = false): Promise<number> {
    // Only use approximate count for unfiltered queries on first page
    if (useApproximate && Object.keys(where).length === 0) {
      try {
        // Try PostgreSQL table statistics first
        const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT reltuples::BIGINT as count 
          FROM pg_class 
          WHERE relname IN ('Post', 'post', '"Post"')
          LIMIT 1
        `;
        if (result[0]?.count && Number(result[0].count) > 0) {
          return Number(result[0].count);
        }
      } catch {
        // Database doesn't support this query or table name is different
        // Fallback to regular count
      }
    }
    
    return this.prisma.post.count({ where });
  }

  async getPostsWithCursor(
    where: Prisma.PostWhereInput,
    orderBy: Prisma.PostOrderByWithRelationInput,
    limit: number,
    cursor?: string | number
  ) {
    const queryOptions: any = {
      where,
      orderBy,
      select: this.getPostSelectFields(),
      take: limit + 1,
    };

    if (cursor) {
      queryOptions.cursor = { id: typeof cursor === 'string' ? parseInt(cursor) : cursor };
      queryOptions.skip = 1;
    }

    const posts = await this.prisma.post.findMany(queryOptions);

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    return {
      data: posts,
      nextCursor: hasMore ? posts[posts.length - 1]?.id?.toString() : null,
      hasMore
    };
  }

  buildSearchOptimizedWhere(filters: any): Prisma.PostWhereInput {
    if (!filters?.search?.trim()) return this.buildWhereClause(filters);

    const searchTerm = filters.search.trim();
    const where = this.buildWhereClause({ ...filters, search: undefined });

    // Optimized search based on term length
    if (searchTerm.length > 2) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { user: { username: { contains: searchTerm, mode: 'insensitive' } } }
      ];
    } else {
      where.OR = [
        { title: { startsWith: searchTerm, mode: 'insensitive' } },
        { user: { username: { startsWith: searchTerm, mode: 'insensitive' } } }
      ];
    }

    return where;
  }

  async getAggregatedStats(where: Prisma.PostWhereInput) {
    const stats = await this.prisma.post.aggregate({
      where,
      _count: { id: true },
      _sum: { viewCount: true, likeCount: true, commentCount: true }
    });

    return {
      totalPosts: stats._count.id,
      totalViews: stats._sum.viewCount || 0,
      totalLikes: stats._sum.likeCount || 0,
      totalComments: stats._sum.commentCount || 0
    };
  }

  formatPaginatedResponse(posts: any[], total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      data: posts,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  formatCursorResponse(result: { data: any[], nextCursor: string | null, hasMore: boolean }) {
    return {
      data: result.data,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore
      }
    };
  }
}