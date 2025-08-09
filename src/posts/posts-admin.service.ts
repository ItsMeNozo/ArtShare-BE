import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { UpdatePostDto } from './dto/request/update-post.dto';
import { PostCategoryResponseDto } from './dto/response/category.dto';
import { PostDetailsResponseDto } from './dto/response/post-details.dto';
import { PostsQueryBuilder } from './utils/posts-query-builder';

export class AdminPostListItemUserDto {
  id: string;
  username: string;
  profilePictureUrl?: string | null;
}

export class AdminPostListItemDto {
  id: number;
  userId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  isPublished: boolean;
  isPrivate: boolean;
  aiCreated: boolean;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: Date;
  user: AdminPostListItemUserDto;
  categories: PostCategoryResponseDto[];
}

@Injectable()
export class PostsAdminService {
  private readonly logger = new Logger(PostsAdminService.name);

  private static readonly POST_DETAILS_SELECT = {
    id: true,
    userId: true,
    title: true,
    description: true,
    thumbnailUrl: true,
    isPublished: true,
    isPrivate: true,
    likeCount: true,
    shareCount: true,
    commentCount: true,
    createdAt: true,
    user: {
      select: { id: true, username: true, fullName: true, profilePictureUrl: true }
    },
    medias: {
      select: { mediaType: true, description: true, url: true, creatorId: true, downloads: true, createdAt: true }
    },
    categories: {
      select: { id: true, name: true, type: true }
    }
  };

  constructor(
    private prisma: PrismaService,
    private queryBuilder: PostsQueryBuilder,
    private storageService: StorageService,
  ) {}

  private static mapToPostDetails(post: any): PostDetailsResponseDto {
    return plainToInstance(PostDetailsResponseDto, {
      id: post.id,
      userId: post.userId,
      title: post.title,
      description: post.description ?? undefined,
      thumbnailUrl: post.thumbnailUrl,
      isPublished: post.isPublished,
      isPrivate: post.isPrivate,
      likeCount: post.likeCount,
      shareCount: post.shareCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
      medias: post.medias?.map((media: any) => ({
        mediaType: media.mediaType,
        description: media.description ?? undefined,
        url: media.url,
        creatorId: media.creatorId,
        downloads: media.downloads,
        createdAt: media.createdAt,
      })) || [],
      user: post.user, // Include all user data, let class-transformer handle exclusions
      categories: post.categories?.map((category: any) => ({
        id: category.id,
        name: category.name,
        type: category.type,
      })) || [],
    });
  }

  private static mapToAdminListItem(post: any): AdminPostListItemDto {
    return {
      id: post.id,
      userId: post.userId,
      title: post.title,
      description: post.description ?? undefined,
      thumbnailUrl: post.thumbnailUrl,
      isPublished: post.isPublished,
      isPrivate: post.isPrivate,
      aiCreated: post.aiCreated,
      likeCount: post.likeCount,
      shareCount: post.shareCount,
      commentCount: post.commentCount,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      user: {
        id: post.user.id,
        username: post.user.username,
        profilePictureUrl: post.user.profilePictureUrl,
      },
      categories: post.categories?.map((category: any) => ({
        id: category.id,
        name: category.name,
        type: category.type,
      })) || [],
    };
  }

  async getAllPostsForAdmin(params: PaginationQueryDto): Promise<PaginatedResponse<AdminPostListItemDto>> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc', filter } = params;
    
    const where = this.queryBuilder.buildSearchOptimizedWhere({ search, ...filter });
    const orderBy = this.queryBuilder.buildOrderBy(sortBy, sortOrder);
    
    const useApproximate = !search && page === 1;
    
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: this.queryBuilder.getAdminPostSelectFields()
      }),
      this.queryBuilder.getOptimizedCount(where, useApproximate)
    ]);

    const responsePosts = posts.map(PostsAdminService.mapToAdminListItem);
    
    return this.queryBuilder.formatPaginatedResponse(responsePosts, total, page, limit);
  }

  async getPostByIdForAdmin(postId: number): Promise<PostDetailsResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: PostsAdminService.POST_DETAILS_SELECT
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found.`);
    }

    return PostsAdminService.mapToPostDetails(post);
  }

  async updatePostByAdmin(
    postId: number,
    updatePostDto: UpdatePostDto,
    images: Express.Multer.File[] = [],
    adminUserId: string,
  ): Promise<PostDetailsResponseDto> {
    // If files are uploaded but no thumbnailUrl is provided, handle file upload
    if (images && images.length > 0 && !updatePostDto.thumbnailUrl) {
      return this.handleFileUploadUpdate(postId, updatePostDto, images, adminUserId);
    }
    
    const dataToUpdate = this.buildUpdateData(updatePostDto, postId);
    
    try {
      const updatedPost = await this.prisma.post.update({
        where: { id: postId },
        data: dataToUpdate,
        select: PostsAdminService.POST_DETAILS_SELECT
      });
      
      return PostsAdminService.mapToPostDetails(updatedPost);
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Post with ID ${postId} not found.`);
      }
      throw error;
    }
  }

  private async handleFileUploadUpdate(
    postId: number, 
    updatePostDto: UpdatePostDto, 
    images: Express.Multer.File[], 
    _adminUserId: string
  ): Promise<PostDetailsResponseDto> {
    try {
      // Upload files to storage
      const uploadResults = await this.storageService.uploadFiles(images, 'posts');
      
      // Use the first uploaded image as thumbnail
      const newThumbnailUrl = uploadResults[0]?.url;
      
      if (newThumbnailUrl) {
        // Update the DTO with the new thumbnail URL
        const updatedDto = { ...updatePostDto, thumbnailUrl: newThumbnailUrl };
        
        // Build and apply the update
        const dataToUpdate = this.buildUpdateData(updatedDto, postId);
        
        const updatedPost = await this.prisma.post.update({
          where: { id: postId },
          data: dataToUpdate,
          select: PostsAdminService.POST_DETAILS_SELECT
        });
        
        return PostsAdminService.mapToPostDetails(updatedPost);
      } else {
        throw new Error('Failed to upload thumbnail file');
      }
    } catch (error) {
      this.logger.error(`Failed to handle file upload for post ${postId}:`, error);
      throw error;
    }
  }

  private buildUpdateData(updatePostDto: UpdatePostDto, postId: number): Prisma.PostUpdateInput {
    const dataToUpdate: Prisma.PostUpdateInput = {};

    if (updatePostDto.title) dataToUpdate.title = updatePostDto.title;
    if (updatePostDto.description) dataToUpdate.description = updatePostDto.description;
    if (updatePostDto.isMature !== undefined) dataToUpdate.isMature = updatePostDto.isMature;
    if (updatePostDto.aiCreated !== undefined) dataToUpdate.aiCreated = updatePostDto.aiCreated;
    if (updatePostDto.thumbnailUrl !== undefined) dataToUpdate.thumbnailUrl = updatePostDto.thumbnailUrl;

    if (updatePostDto.thumbnailCropMeta !== undefined) {
      try {
        dataToUpdate.thumbnailCropMeta = typeof updatePostDto.thumbnailCropMeta === 'string'
          ? JSON.parse(updatePostDto.thumbnailCropMeta)
          : updatePostDto.thumbnailCropMeta;
      } catch (e: any) {
        this.logger.warn(`Invalid thumbnailCropMeta for post ${postId}: ${e.message}`);
      }
    }

    if (updatePostDto.categoryIds !== undefined) {
      if (updatePostDto.categoryIds.length === 0) {
        dataToUpdate.categories = { set: [] };
      } else {
        dataToUpdate.categories = {
          set: updatePostDto.categoryIds.map((id) => ({ id })),
        };
      }
    }

    if (updatePostDto.videoUrl) {
      this.logger.warn(`video_url ignored for post ${postId} - use media management`);
    }

    return dataToUpdate;
  }

  async deletePostByAdmin(
    postId: number,
    adminUserId: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      await this.prisma.post.delete({ where: { id: postId } });
      this.logger.log(`Admin ${adminUserId} deleted post ${postId}`);
      return { success: true, message: `Post ${postId} deleted successfully.` };
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Post with ID ${postId} not found.`);
      }
      throw error;
    }
  }

  async bulkUpdatePublishStatus(
    postIds: number[],
    publish: boolean,
    adminUserId: string,
  ): Promise<{ count: number }> {
    if (postIds.length === 0) return { count: 0 };

    const result = await this.prisma.post.updateMany({
      where: { id: { in: postIds } },
      data: { isPublished: publish, updatedAt: new Date() },
    });

    this.logger.log(`Admin ${adminUserId} ${publish ? 'published' : 'unpublished'} ${result.count}/${postIds.length} posts`);
    return { count: result.count };
  }

  async bulkDeletePosts(
    postIds: number[],
    adminUserId: string,
  ): Promise<{ count: number }> {
    if (postIds.length === 0) return { count: 0 };

    const result = await this.prisma.post.deleteMany({
      where: { id: { in: postIds } }
    });

    this.logger.log(`Admin ${adminUserId} deleted ${result.count}/${postIds.length} posts`);
    return { count: result.count };
  }

  async getPostsStats(filters?: any) {
    const where = this.queryBuilder.buildWhereClause(filters || {});
    return this.queryBuilder.getAggregatedStats(where);
  }

  async bulkUpdateCategories(
    postIds: number[],
    categoryIds: number[],
    adminUserId: string,
  ): Promise<{ count: number }> {
    if (postIds.length === 0) return { count: 0 };

    let updatedCount = 0;
    
    await this.prisma.$transaction(async (tx) => {
      for (const postId of postIds) {
        try {
          await tx.post.update({
            where: { id: postId },
            data: {
              categories: { set: categoryIds.map(id => ({ id })) },
              updatedAt: new Date()
            }
          });
          updatedCount++;
         } catch (error) {
          this.logger.error(
            `Failed to update categories for post ${postId}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    });

    this.logger.log(`Admin ${adminUserId} updated categories for ${updatedCount}/${postIds.length} posts`);
    return { count: updatedCount };
  }
}