import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { UpdatePostDto } from './dto/request/update-post.dto';
import { PostCategoryResponseDto } from './dto/response/category.dto';
import { MediaResponseDto } from './dto/response/media.dto';
import { PostDetailsResponseDto } from './dto/response/post-details.dto';
import { UserResponseDto } from './dto/response/user.dto';

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
  likeCount: number;
  shareCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: Date;
  user: AdminPostListItemUserDto;
  categories: PostCategoryResponseDto[];
}

type PrismaPostForDetails = Prisma.PostGetPayload<{
  include: {
    user: true;
    medias: true;
    categories: true;
  };
}>;

type PrismaPostForList = Prisma.PostGetPayload<{
  include: {
    user: true;
    categories: true;
  };
}>;

@Injectable()
export class PostsAdminService {
  private readonly logger = new Logger(PostsAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  private mapPrismaPostToPostDetailsDto(
    post: PrismaPostForDetails,
  ): PostDetailsResponseDto {
    const userDto = new UserResponseDto();
    userDto.id = post.user.id;
    userDto.username = post.user.username;
    userDto.fullName = post.user.fullName ?? '';
    userDto.profilePictureUrl = post.user.profilePictureUrl ?? '';

    return {
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
      medias: post.medias.map((media): MediaResponseDto => {
        const mediaDto = new MediaResponseDto();
        mediaDto.mediaType = media.mediaType;
        mediaDto.description = media.description ?? undefined;
        mediaDto.url = media.url;
        mediaDto.creatorId = media.creatorId;
        mediaDto.downloads = media.downloads;
        mediaDto.createdAt = media.createdAt;
        return mediaDto;
      }),
      user: userDto,
      categories: post.categories.map((category): PostCategoryResponseDto => {
        const categoryDto = new PostCategoryResponseDto();
        categoryDto.id = category.id;
        categoryDto.name = category.name;
        categoryDto.type = category.type;
        return categoryDto;
      }),
    };
  }

  private mapPrismaPostToAdminPostListItemDto(
    post: PrismaPostForList,
  ): AdminPostListItemDto {
    return {
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
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      user: {
        id: post.user.id,
        username: post.user.username,
        profilePictureUrl: post.user.profilePictureUrl,
      },
      categories: post.categories.map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type,
      })),
    };
  }

  async getAllPostsForAdmin(
    params: PaginationQueryDto,
  ): Promise<PaginatedResponse<AdminPostListItemDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
      filter,
    } = params;

    const { userId, isPublished, isPrivate, categoryId, aiCreated } =
      filter || {};

    const skip = (page - 1) * limit;
    const where: Prisma.PostWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (userId) where.userId = userId;
    if (isPublished !== undefined) where.isPublished = isPublished;
    if (isPrivate !== undefined) where.isPrivate = isPrivate;
    if (categoryId) {
      where.categories = { some: { id: categoryId } };
    }
    if (aiCreated !== undefined) {
      where.aiCreated = aiCreated;
    }

    const validSortByFields = [
      'createdAt',
      'title',
      'viewCount',
      'likeCount',
      'commentCount',
      'updatedAt',
    ];
    const orderByField = validSortByFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [prismaPosts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: sortOrder },
        include: { user: true, categories: true },
      }),
      this.prisma.post.count({ where }),
    ]);

    const responsePosts: AdminPostListItemDto[] = prismaPosts.map((p) =>
      this.mapPrismaPostToAdminPostListItemDto(p as PrismaPostForList),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: responsePosts,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
    };
  }

  async updatePostByAdmin(
    postId: number,
    updatePostDto: UpdatePostDto,
    adminUserId: string,
  ): Promise<PostDetailsResponseDto> {
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!existingPost)
      throw new NotFoundException(`Post with ID ${postId} not found.`);

    this.logger.log(
      `Admin ${adminUserId} updating post ${postId} with data: ${JSON.stringify(updatePostDto)}`,
    );

    const dataToUpdate: Prisma.PostUpdateInput = {};

    if (updatePostDto.title) dataToUpdate.title = updatePostDto.title;
    if (updatePostDto.description)
      dataToUpdate.description = updatePostDto.description;
    if (updatePostDto.isMature !== undefined)
      dataToUpdate.isMature = updatePostDto.isMature;
    if (updatePostDto.aiCreated !== undefined)
      dataToUpdate.aiCreated = updatePostDto.aiCreated;
    if (updatePostDto.thumbnailUrl !== undefined)
      dataToUpdate.thumbnailUrl = updatePostDto.thumbnailUrl;

    if (updatePostDto.thumbnailCropMeta !== undefined) {
      try {
        dataToUpdate.thumbnailCropMeta =
          typeof updatePostDto.thumbnailCropMeta === 'string'
            ? JSON.parse(updatePostDto.thumbnailCropMeta)
            : updatePostDto.thumbnailCropMeta;
      } catch (e) {
        this.logger.warn(
          `Invalid JSON for thumbnailCropMeta for post ${postId}: ${updatePostDto.thumbnailCropMeta}. Using default or existing value. Error: ${e}`,
        );
      }
    }

    if (updatePostDto.videoUrl) {
      this.logger.warn(
        `'video_url' provided for post ${postId}. This field will be ignored for direct Post update.`,
      );
    }
    if (updatePostDto.existingImageUrls) {
      this.logger.log(
        `Post ${postId}: 'existingImageUrls' received. Full media management logic is not implemented.`,
      );
    }

    if (updatePostDto.categoryIds !== undefined) {
      dataToUpdate.categories = {
        set: updatePostDto.categoryIds.map((id) => ({ id })),
      };
    }

    const updatedPostPrisma = await this.prisma.post.update({
      where: { id: postId },
      data: dataToUpdate,
      include: { user: true, medias: true, categories: true },
    });

    return this.mapPrismaPostToPostDetailsDto(
      updatedPostPrisma as PrismaPostForDetails,
    );
  }

  async deletePostByAdmin(
    postId: number,
    adminUserId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!existingPost)
      throw new NotFoundException(`Post with ID ${postId} not found.`);

    await this.prisma.post.delete({ where: { id: postId } });
    this.logger.log(`Admin ${adminUserId} deleted post ${postId}.`);
    return { success: true, message: `Post ${postId} deleted successfully.` };
  }

  async bulkUpdatePublishStatus(
    postIds: number[],
    publish: boolean,
    adminUserId: string,
  ): Promise<{ count: number }> {
    this.logger.log(
      `Admin ${adminUserId} is ${publish ? 'publishing' : 'unpublishing'} posts: ${postIds.join(', ')}`,
    );
    const result = await this.prisma.post.updateMany({
      where: { id: { in: postIds } },
      data: { isPublished: publish, updatedAt: new Date() },
    });
    return { count: result.count };
  }

  async bulkDeletePosts(
    postIds: number[],
    adminUserId: string,
  ): Promise<{ count: number }> {
    this.logger.log(
      `Admin ${adminUserId} is deleting posts: ${postIds.join(', ')}`,
    );
    const result = await this.prisma.post.deleteMany({
      where: { id: { in: postIds } },
    });
    return { count: result.count };
  }
}
