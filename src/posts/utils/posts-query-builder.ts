// src/posts/utils/posts-query-builder.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PostsQueryBuilder {
  constructor(private prisma: PrismaService) {}

  buildWhereClause(filters: any): Prisma.PostWhereInput {
    const where: Prisma.PostWhereInput = {};
    
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { user: { username: { contains: filters.search, mode: 'insensitive' } } }
      ];
    }
    
    if (filters.userId) where.userId = filters.userId;
    if (filters.isPublished !== undefined) where.isPublished = filters.isPublished;
    if (filters.isPrivate !== undefined) where.isPrivate = filters.isPrivate;
    if (filters.aiCreated !== undefined) where.aiCreated = filters.aiCreated;
    if (filters.categoryId) where.categories = { some: { id: filters.categoryId } };

    return where;
  }

  buildOrderBy(sortBy: string, sortOrder: string) {
    const validFields = ['createdAt', 'title', 'viewCount', 'likeCount', 'commentCount', 'updatedAt'];
    const field = validFields.includes(sortBy) ? sortBy : 'createdAt';
    return { [field]: sortOrder };
  }

  getPostSelectFields() {
    return {
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
  }

  async getOptimizedCount(where: Prisma.PostWhereInput): Promise<number> {
    // Always use accurate count for admin pagination to prevent pagination issues
    return this.prisma.post.count({ where });
  }

  formatPaginatedResponse(posts: any[], total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      data: posts,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages
    };
  }
}