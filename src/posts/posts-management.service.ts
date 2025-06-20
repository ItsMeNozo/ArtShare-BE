import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { TryCatch } from 'src/common/try-catch.decorator';
import embeddingConfig from 'src/config/embedding.config';
import { QdrantService } from 'src/embedding/qdrant.service';
import { MediaType, Post } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { FileUploadResponse } from 'src/storage/dto/response.dto';
import { StorageService } from 'src/storage/storage.service';
import { FollowerDto } from 'src/user/dto/follower.dto';
import { UserFollowService } from 'src/user/user.follow.service';
import { NotificationUtils } from '../common/utils/notification.utils';
import { CreatePostRequestDto } from './dto/request/create-post.dto';
import { PatchThumbnailDto } from './dto/request/patch-thumbnail.dto';
import { UpdatePostDto } from './dto/request/update-post.dto';
import { PostDetailsResponseDto } from './dto/response/post-details.dto';
import { PostsEmbeddingService } from './posts-embedding.service';
import { PostsManagementValidator } from './validator/posts-management.validator';

@Injectable()
export class PostsManagementService {
  private readonly logger = new Logger(PostsManagementService.name);
  private readonly postsCollectionName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly qdrantService: QdrantService,
    private readonly postEmbeddingService: PostsEmbeddingService,
    private readonly postsManagementValidator: PostsManagementValidator,
    private readonly followService: UserFollowService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(embeddingConfig.KEY)
    private embeddingConf: ConfigType<typeof embeddingConfig>,
  ) {
    this.postsCollectionName = this.embeddingConf.postsCollectionName;
  }

  @TryCatch()
  async createPost(
    request: CreatePostRequestDto,
    images: Express.Multer.File[],
    userId: string,
  ): Promise<PostDetailsResponseDto> {
    const { cate_ids = [], video_url, prompt_id, ...rest } = request;

    const { parsedCropMeta } =
      await this.postsManagementValidator.validateCreateRequest(
        request,
        images,
      );

    if (prompt_id) {
      await this.validateAiArtExistence(prompt_id);
    }

    const mediasToCreate = await this.buildMediasToCreate(
      images,
      userId,
      video_url,
    );

    const createdPost = await this.prisma.post.create({
      data: {
        user_id: userId,
        art_generation_id: prompt_id,
        ...rest,
        medias: { create: mediasToCreate },
        categories: { connect: cate_ids.map((id) => ({ id })) },
        thumbnail_crop_meta: parsedCropMeta,
      },
      include: { medias: true, user: true, categories: true },
    });

    void this.postEmbeddingService.upsertPostEmbedding(
      createdPost.id,
      createdPost.title,
      createdPost.description ?? undefined,
      images,
    );

    const followers: FollowerDto[] =
      await this.followService.getFollowersListByUserId(userId);

    // Filter out the post author from followers and send notifications
    const notificationRecipients =
      NotificationUtils.filterNotificationRecipients(followers, userId);

    for (const follower of notificationRecipients) {
      this.eventEmitter.emit('push-notification', {
        from: userId,
        to: follower.id,
        type: 'artwork_published',
        post: { title: createdPost.title },
        postId: createdPost.id.toString(),
        postTitle: createdPost.title,
        createdAt: new Date(),
      });
    }

    return plainToInstance(PostDetailsResponseDto, createdPost);
  }

  private async buildMediasToCreate(
    images: Express.Multer.File[],
    userId: string,
    video_url?: string,
  ): Promise<MediaTocreate[]> {
    const mediasToCreate: MediaTocreate[] = [];

    if (video_url) {
      mediasToCreate.push({
        url: video_url,
        media_type: MediaType.video,
        creator_id: userId,
      });
    }

    if (images.length > 0) {
      const uploadedImages = await this.storageService.uploadFiles(
        images,
        'posts',
      );
      mediasToCreate.push(
        ...uploadedImages.map(({ url }) => ({
          url,
          media_type: MediaType.image,
          creator_id: userId,
        })),
      );
    }

    return mediasToCreate;
  }

  private async validateAiArtExistence(prompt_id: number): Promise<void> {
    const artGeneration = await this.prisma.artGeneration.findUnique({
      where: { id: prompt_id },
    });
    if (!artGeneration) {
      throw new BadRequestException('AI art generation not found');
    }
  }

  @TryCatch()
  async updatePost(
    postId: number,
    updatePostDto: UpdatePostDto,
    images: Express.Multer.File[],
    userId: string,
  ): Promise<PostDetailsResponseDto> {
    // return an error for testing purposes
    // throw new BadRequestException('Testing error handling in deletePost');
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { medias: true },
    });

    if (!existingPost) {
      throw new NotFoundException('Post not found');
    }

    const {
      cate_ids,
      video_url,
      existing_image_urls = [],
      thumbnail_url,
      ...postUpdateData
    } = updatePostDto;

    // images to retain
    const existingImageUrlsSet = new Set(existing_image_urls);

    /** ────────────── HANDLE IMAGE DELETION ────────────── */
    const existingImages = existingPost.medias.filter(
      (m) => m.media_type === MediaType.image,
    );

    const imagesToDelete = existingImages.filter(
      (m) => !existingImageUrlsSet.has(m.url),
    );

    // 1️⃣ Delete the old thumbnail if it’s been replaced
    const oldThumb = existingPost.thumbnail_url;
    if (thumbnail_url && oldThumb && thumbnail_url !== oldThumb) {
      this.logger.log(
        `Deleting old thumbnail in s3 for post ${postId} with URL: ${oldThumb}`,
      );
      await this.storageService.deleteFiles([oldThumb]);
    }

    if (imagesToDelete.length > 0) {
      this.logger.log(
        `Deleting ${imagesToDelete.length} old images in s3 for post ${postId}`,
      );
      await Promise.all([
        this.prisma.media.deleteMany({
          where: {
            id: { in: imagesToDelete.map((m) => m.id) },
          },
        }),
        this.storageService.deleteFiles(imagesToDelete.map((m) => m.url)),
      ]);
    }

    /** ────────────── HANDLE NEW IMAGE UPLOADS ────────────── */
    let newImageUploads: FileUploadResponse[] = [];
    if (images && images.length > 0) {
      this.logger.log(
        `Uploading ${images.length} new images to s3 for post ${postId}`,
      );
      newImageUploads = await this.storageService.uploadFiles(images, 'posts');
    }

    /** ────────────── HANDLE VIDEO UPDATE ────────────── */
    /* 1️⃣ normalise the raw value coming from the DTO */
    const videoUrl = (video_url ?? '').trim(); // '' when user deletes
    const existingVideo = existingPost.medias.find(
      (m) => m.media_type === MediaType.video,
    );

    /* 2️⃣ decide what the user wants to do */
    const wantsDeletion = existingVideo && videoUrl === '';
    const wantsReplace =
      existingVideo && videoUrl && videoUrl !== existingVideo.url;
    const wantsNewUpload = !existingVideo && videoUrl; // first‑time video

    /* 3️⃣ delete the old video row + file only when needed */
    if (wantsDeletion || wantsReplace) {
      this.logger.log(
        `Deleting existing video in s3 for post ${postId} with URL: ${existingVideo?.url}`,
      );
      await Promise.all([
        this.prisma.media.delete({ where: { id: existingVideo.id } }),
        this.storageService.deleteFiles([existingVideo.url]),
      ]);
    }

    /** ────────────── COMBINE NEW MEDIA ────────────── */
    const mediasData: MediaData[] = [
      ...(wantsReplace || wantsNewUpload
        ? [{ url: videoUrl, media_type: MediaType.video }]
        : []),
      ...newImageUploads.map(({ url }) => ({
        url,
        media_type: MediaType.image,
      })),
    ];

    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: {
        ...postUpdateData,
        thumbnail_crop_meta: JSON.parse(updatePostDto.thumbnail_crop_meta),
        thumbnail_url: thumbnail_url,
        categories: {
          set: (cate_ids || []).map((id) => ({ id })),
        },
        ...(mediasData.length > 0 && {
          medias: {
            create: mediasData.map(({ url, media_type }) => ({
              media_type,
              url,
              creator_id: userId,
            })),
          },
        }),
      },
      include: { medias: true, user: true, categories: true },
    });

    const currentImageUrls = updatedPost.medias
      .filter((m) => m.media_type === MediaType.image)
      .map((m) => m.url);

    this.postEmbeddingService.updatePostEmbedding(
      updatedPost.id,
      updatePostDto.title === existingPost.title
        ? undefined
        : updatePostDto.title,
      updatePostDto.description === existingPost.description
        ? undefined
        : updatePostDto.description,
      imagesToDelete.length > 0 || images.length > 0
        ? currentImageUrls
        : undefined,
    );

    return plainToInstance(PostDetailsResponseDto, updatedPost);
  }

  @TryCatch()
  async deletePost(postId: number): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { medias: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    const deletedPost = await this.prisma.post.delete({
      where: { id: postId },
    });

    void this.cleanupExternalResources(
      postId,
      post.medias.map((m) => m.url),
    ).catch((err) => {
      console.error(`Failed external cleanup for post ${postId}:`, err);
    });

    return deletedPost;
  }

  private async cleanupExternalResources(postId: number, urls: string[]) {
    if (urls.length) {
      await this.storageService.deleteFiles(urls);
    }
    await this.qdrantService.deletePoints(this.postsCollectionName, [postId]);
  }

  async updateThumbnailCropMeta(
    postId: number,
    dto: PatchThumbnailDto,
    userId: string,
  ) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });

    if (!post || post.user_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        thumbnail_crop_meta: { ...dto }, // assuming JSON column
      },
    });
  }
}

class MediaTocreate {
  url: string;
  media_type: MediaType;
  creator_id: string;
}

export class MediaData {
  url: string;
  media_type: MediaType;
}
