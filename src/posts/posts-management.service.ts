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
import axios from 'axios';
import { plainToInstance } from 'class-transformer';
import sharp from 'sharp';
import { TryCatch } from 'src/common/try-catch.decorator';
import { NotificationUtils } from 'src/common/utils/notification.utils';
import embeddingConfig from 'src/config/embedding.config';
import { QdrantService } from 'src/embedding/qdrant.service';
import { MediaType, Post } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { FileUploadResponse } from 'src/storage/dto/response.dto';
import { StorageService } from 'src/storage/storage.service';
import { FollowerDto } from 'src/user/dto/follower.dto';
import { UserFollowService } from 'src/user/user.follow.service';
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
    const {
      categoryIds = [],
      videoUrl,
      promptId,
      thumbnailUrl,
      ...rest
    } = request;

    const { parsedCropMeta } =
      await this.postsManagementValidator.validateCreateRequest(
        request,
        images,
      );

    if (promptId) {
      await this.validateAiArtExistence(promptId);
    }

    const mediasToCreate = await this.buildMediasToCreate(
      images,
      userId,
      videoUrl,
    );

    let thumbnailWidth: number | undefined | null = undefined;
    let thumbnailHeight: number | undefined | null = undefined;

    try {
      const response = await axios.get(thumbnailUrl, {
        responseType: 'arraybuffer',
      });
      const imageBuffer = Buffer.from(response.data, 'binary');

      const metadata = await sharp(imageBuffer).metadata();
      thumbnailWidth = metadata.width;
      thumbnailHeight = metadata.height;
    } catch (error) {
      console.error(
        `Failed to download or process thumbnail from URL: ${thumbnailUrl}`,
        error,
      );
      thumbnailWidth = null;
      thumbnailHeight = null;
    }

    const createdPost = await this.prisma.post.create({
      data: {
        userId,
        artGenerationId: promptId,
        thumbnailUrl,
        thumbnailWidth,
        thumbnailHeight,
        ...rest,
        medias: { create: mediasToCreate },
        categories: { connect: categoryIds.map((id) => ({ id })) },
        thumbnailCropMeta: parsedCropMeta,
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
    videoUrl?: string,
  ): Promise<MediaTocreate[]> {
    const mediasToCreate: MediaTocreate[] = [];

    if (videoUrl) {
      mediasToCreate.push({
        url: videoUrl,
        mediaType: MediaType.video,
        creatorId: userId,
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
          mediaType: MediaType.image,
          creatorId: userId,
        })),
      );
    }

    return mediasToCreate;
  }

  private async validateAiArtExistence(promptId: number): Promise<void> {
    const artGeneration = await this.prisma.artGeneration.findUnique({
      where: { id: promptId },
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
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { medias: true },
    });

    if (!existingPost) {
      throw new NotFoundException('Post not found');
    }

    const {
      categoryIds,
      videoUrl,
      existingImageUrls = [],
      thumbnailUrl,
      ...postUpdateData
    } = updatePostDto;

    const existingImageUrlsSet = new Set(existingImageUrls);

    /** ────────────── HANDLE IMAGE DELETION ────────────── */
    const existingImages = existingPost.medias.filter(
      (m) => m.mediaType === MediaType.image,
    );

    const imagesToDelete = existingImages.filter(
      (m) => !existingImageUrlsSet.has(m.url),
    );

    const oldThumb = existingPost.thumbnailUrl;
    if (thumbnailUrl && oldThumb && thumbnailUrl !== oldThumb) {
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
    const normalizedVideoUrl = (videoUrl ?? '').trim();
    const existingVideo = existingPost.medias.find(
      (m) => m.mediaType === MediaType.video,
    );

    /* 2️⃣ decide what the user wants to do */
    const wantsDeletion = existingVideo && normalizedVideoUrl === '';
    const wantsReplace =
      existingVideo &&
      normalizedVideoUrl &&
      normalizedVideoUrl !== existingVideo.url;
    const wantsNewUpload = !existingVideo && normalizedVideoUrl;

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
        ? [{ url: normalizedVideoUrl, mediaType: MediaType.video }]
        : []),
      ...newImageUploads.map(({ url }) => ({
        url,
        mediaType: MediaType.image,
      })),
    ];

    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: {
        ...postUpdateData,
        thumbnailCropMeta: JSON.parse(updatePostDto.thumbnailCropMeta),
        thumbnailUrl: thumbnailUrl,
        categories: {
          set: (categoryIds || []).map((id) => ({ id })),
        },
        ...(mediasData.length > 0 && {
          medias: {
            create: mediasData.map(({ url, mediaType }) => ({
              mediaType,
              url,
              creatorId: userId,
            })),
          },
        }),
      },
      include: { medias: true, user: true, categories: true },
    });

    const currentImageUrls = updatedPost.medias
      .filter((m) => m.mediaType === MediaType.image)
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

    if (!post || post.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        thumbnailCropMeta: { ...dto },
      },
    });
  }
}

class MediaTocreate {
  url: string;
  mediaType: MediaType;
  creatorId: string;
}

export class MediaData {
  url: string;
  mediaType: MediaType;
}
