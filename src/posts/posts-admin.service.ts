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
  profile_picture_url?: string | null;
}
export class AdminPostListItemDto {
  id: number;
  user_id: string;
  title: string;
  description?: string;
  thumbnail_url: string;
  is_published: boolean;
  is_private: boolean;
  like_count: number;
  share_count: number;
  comment_count: number;
  view_count: number;
  created_at: Date;
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
    userDto.full_name = post.user.full_name ?? '';
    userDto.profile_picture_url = post.user.profile_picture_url ?? '';

    return {
      id: post.id,
      user_id: post.user_id,
      title: post.title,
      description: post.description ?? undefined,
      thumbnail_url: post.thumbnail_url,
      is_published: post.is_published,
      is_private: post.is_private,
      like_count: post.like_count,
      share_count: post.share_count,
      comment_count: post.comment_count,
      created_at: post.created_at,
      medias: post.medias.map((media): MediaResponseDto => {
        const mediaDto = new MediaResponseDto();
        mediaDto.media_type = media.media_type;
        mediaDto.description = media.description ?? undefined;
        mediaDto.url = media.url;
        mediaDto.creator_id = media.creator_id;
        mediaDto.downloads = media.downloads;
        mediaDto.created_at = media.created_at;
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
      user_id: post.user_id,
      title: post.title,
      description: post.description ?? undefined,
      thumbnail_url: post.thumbnail_url,
      is_published: post.is_published,
      is_private: post.is_private,
      like_count: post.like_count,
      share_count: post.share_count,
      comment_count: post.comment_count,
      view_count: post.view_count,
      created_at: post.created_at,
      user: {
        id: post.user.id,
        username: post.user.username,
        profile_picture_url: post.user.profile_picture_url ?? null,
      },
      categories: (post.categories ?? []).map((category) => {
        const categoryDto = new PostCategoryResponseDto();
        categoryDto.id = category.id;
        categoryDto.name = category.name;
        categoryDto.type = category.type;
        return categoryDto;
      }),
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
    if (userId) where.user_id = userId;
    if (isPublished !== undefined) where.is_published = isPublished;
    if (isPrivate !== undefined) where.is_private = isPrivate;
    if (categoryId) {
      where.categories = { some: { id: categoryId } };
    }
    if (aiCreated !== undefined) {
      where.ai_created = aiCreated;
    }

    const validSortByFields = [
      'created_at',
      'title',
      'view_count',
      'like_count',
      'comment_count',
      'updated_at',
    ];
    const orderByField = validSortByFields.includes(sortBy)
      ? sortBy
      : 'created_at';

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
    if (updatePostDto.title !== undefined)
      dataToUpdate.title = updatePostDto.title;
    if (updatePostDto.description !== undefined)
      dataToUpdate.description = updatePostDto.description;
    if (updatePostDto.is_mature !== undefined)
      dataToUpdate.is_mature = updatePostDto.is_mature;
    if (updatePostDto.ai_created !== undefined)
      dataToUpdate.ai_created = updatePostDto.ai_created;
    if (updatePostDto.thumbnail_url !== undefined)
      dataToUpdate.thumbnail_url = updatePostDto.thumbnail_url;

    if (updatePostDto.thumbnail_crop_meta !== undefined) {
      try {
        dataToUpdate.thumbnail_crop_meta =
          typeof updatePostDto.thumbnail_crop_meta === 'string'
            ? JSON.parse(updatePostDto.thumbnail_crop_meta)
            : updatePostDto.thumbnail_crop_meta;
      } catch (e) {
        this.logger.warn(
          `Invalid JSON for thumbnail_crop_meta for post ${postId}: ${updatePostDto.thumbnail_crop_meta}. Using default or existing value. Error: ${e}`,
        );
      }
    }

    if (updatePostDto.video_url) {
      this.logger.warn(
        `'video_url' provided for post ${postId}. This field will be ignored for direct Post update.`,
      );
    }
    if (updatePostDto.existing_image_urls) {
      this.logger.log(
        `Post ${postId}: 'existing_image_urls' received. Full media management logic is not implemented.`,
      );
    }

    if (updatePostDto.cate_ids !== undefined) {
      dataToUpdate.categories = {
        set: updatePostDto.cate_ids.map((id) => ({ id })),
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
      data: { is_published: publish, updated_at: new Date() },
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
