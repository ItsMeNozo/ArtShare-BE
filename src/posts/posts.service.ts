import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { plainToInstance } from 'class-transformer';
import { StorageService } from 'src/storage/storage.service';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { MediaType, Post } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { TryCatch } from 'src/common/try-catch.decorator.';
import { CreatePostDto } from './dto/request/create-post.dto';
import { PostDetailsResponseDto } from './dto/response/post-details.dto';
import { UpdatePostDto } from './dto/request/update-post.dto';
import { PostListItemResponseDto } from './dto/response/post-list-item.dto';
import { FileUploadResponse } from 'src/storage/dto/response.dto';

class VectorParams {
  titleEmbedding?: number[];
  descriptionEmbdding?: number[];
  imagesEmbedding?: number[][];
}

export class MediaData {
  url: string;
  media_type: MediaType;
}

@Injectable()
export class PostsService {
  private readonly qdrantCollectionName = 'posts';
  private readonly qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    port: 6333,
    apiKey: process.env.QDRANT_API_KEY,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @TryCatch()
  async createPost(
    createPostDto: CreatePostDto,
    images: Express.Multer.File[],
    userId: string,
  ): Promise<PostDetailsResponseDto> {
    const { cate_ids, video_url, ...createPostData } = createPostDto;

    if (images.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    const imageUploads: FileUploadResponse[] =
      await this.storageService.uploadFiles(images, 'posts');

    const mediasData = [
      ...(video_url ? [{ url: video_url, media_type: MediaType.video }] : []),
      ...imageUploads.map(({ url }) => ({ url, media_type: MediaType.image })),
    ];

    const post = await this.prisma.post.create({
      data: {
        user_id: userId,
        ...createPostData,
        thumbnail_url: imageUploads[0].url, // Set thumbnail_url to the first image
        medias: {
          create: mediasData.map(({ url, media_type }) => ({
            media_type,
            url,
            creator_id: userId,
          })),
        },
        categories: {
          connect: (cate_ids || []).map((cate_id) => ({ id: cate_id })),
        },
      },
      include: { medias: true, user: true, categories: true },
    });

    await this.savePostEmbedding(
      post.id,
      createPostData.title,
      createPostData.description,
      images,
    );

    return plainToInstance(PostDetailsResponseDto, post);
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

    const { cate_ids, video_url, ...postUpdateData } = updatePostDto;

    let newImageUploads: FileUploadResponse[] = [];
    if (images && images.length > 0) {
      // do this to delete in db and s3 at the same time
      const deleteImagePromises = [
        this.prisma.media.deleteMany({ where: { post_id: postId } }),
        this.storageService.deleteFiles(
          existingPost.medias.map((media) => media.url),
        ),
      ];
      await Promise.all(deleteImagePromises);
      newImageUploads = await this.storageService.uploadFiles(images, 'posts');
    }

    if (video_url) {
      const existingVideo = existingPost.medias.find(
        (media) => media.media_type === MediaType.video,
      );
      if (existingVideo) {
        const deleteVideoPromise = [
          this.prisma.media.delete({ where: { id: existingVideo.id } }),
          this.storageService.deleteFiles([existingVideo.url]),
        ];
        await Promise.all(deleteVideoPromise);
      }
    }

    const mediasData: MediaData[] = [
      ...(video_url ? [{ url: video_url, media_type: MediaType.video }] : []),
      ...newImageUploads.map(({ url }) => ({
        url,
        media_type: MediaType.image,
      })),
    ];

    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: {
        ...postUpdateData,
        categories: {
          set: (cate_ids || []).map((cate_id) => ({ id: cate_id })),
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

    this.updatePostEmbedding(
      postId,
      postUpdateData.title,
      postUpdateData.description,
      images,
    );

    return plainToInstance(PostDetailsResponseDto, updatedPost);
  }

  async deletePost(postId: number): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { medias: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.medias && post.medias.length > 0) {
      await Promise.all(
        post.medias.map((media) =>
          this.storageService.deleteFiles([media.url]),
        ),
      );
    }

    return this.prisma.post.delete({ where: { id: postId } });
  }

  async getForYouPosts(
    userId: string,
    page: number,
    page_size: number,
  ): Promise<Post[]> {
    const skip = (page - 1) * page_size;

    return this.prisma.post.findMany({
      where: { is_published: true },
      orderBy: { share_count: 'desc' },
      take: page_size,
      skip,
      include: { medias: true },
    });
  }

  async getPostDetails(postId: number): Promise<PostDetailsResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { medias: true, user: true, categories: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return plainToInstance(PostDetailsResponseDto, post);
  }

  async getFollowingPosts(
    userId: string,
    page: number,
    page_size: number,
  ): Promise<PostListItemResponseDto[]> {
    const followingUsers = await this.prisma.follow.findMany({
      where: { follower_id: userId },
      select: { following_id: true },
    });

    const followingIds = followingUsers.map((follow) => follow.following_id);

    const skip = (page - 1) * page_size;

    const posts = await this.prisma.post.findMany({
      where: {
        user_id: { in: followingIds },
      },
      skip,
      take: page_size,
      include: {
        medias: true,
        user: true,
        categories: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return plainToInstance(PostListItemResponseDto, posts);
  }

  @TryCatch()
  async searchPosts(
    query: string,
    page: number,
    page_size: number,
  ): Promise<PostListItemResponseDto[]> {
    console.log('page:', page, 'page_size:', page_size);
    const queryEmbedding =
      await this.embeddingService.generateEmbeddingFromText(query);
    const searchResponse = await this.qdrantClient.query(
      this.qdrantCollectionName,
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
        offset: (page - 1) * page_size,
        limit: page_size,
        // with_payload: true,
      },
    );

    const pointIds: number[] = searchResponse.points.map((point) =>
      Number(point.id),
    );

    const posts = await this.prisma.post.findMany({
      where: { id: { in: pointIds } },
      include: { medias: true, user: true, categories: true },
    });

    // Sort posts in the same order as returned by Qdrant
    const sortedPosts = pointIds.map((id) =>
      posts.find((post) => post.id === id),
    );
    return plainToInstance(PostListItemResponseDto, sortedPosts);
  }

  private async getVectorParams(
    title: string | undefined,
    description: string | undefined,
    imageFiles: Express.Multer.File[],
  ): Promise<VectorParams> {
    const [titleEmbedding, descriptionEmbedding, imageEmbeddings] =
      await Promise.all([
        title
          ? this.embeddingService.generateEmbeddingFromText(title)
          : undefined,
        description
          ? this.embeddingService.generateEmbeddingFromText(description)
          : undefined,
        imageFiles && imageFiles.length > 0
          ? Promise.all(
              imageFiles.map((image) =>
                this.embeddingService.generateEmbeddingFromImageBlob(
                  new Blob([image.buffer]),
                ),
              ),
            )
          : undefined,
      ]);

    return {
      titleEmbedding: titleEmbedding,
      descriptionEmbdding: descriptionEmbedding,
      imagesEmbedding: imageEmbeddings,
    };
  }

  @TryCatch()
  private async savePostEmbedding(
    postId: number,
    title: string,
    description: string | undefined,
    imageFiles: Express.Multer.File[],
  ): Promise<void> {
    const { titleEmbedding, descriptionEmbdding, imagesEmbedding } =
      await this.getVectorParams(title, description, imageFiles);

    const operationInfo = await this.qdrantClient.upsert(
      this.qdrantCollectionName,
      {
        wait: true,
        points: [
          {
            id: postId,
            vector: {
              title: titleEmbedding,
              description: descriptionEmbdding,
              images: imagesEmbedding,
            },
            payload: { postId: postId },
          },
        ],
      },
    );

    console.log('Upsert operation info:', operationInfo);
  }

  @TryCatch()
  private async updatePostEmbedding(
    postId: number,
    title: string | undefined,
    description: string | undefined,
    imageFiles: Express.Multer.File[],
  ): Promise<void> {
    const {
      titleEmbedding,
      descriptionEmbdding,
      imagesEmbedding,
    }: VectorParams = await this.getVectorParams(
      title,
      description,
      imageFiles,
    );

    const operationInfo = await this.qdrantClient.updateVectors(
      this.qdrantCollectionName,
      {
        points: [
          {
            id: postId,
            vector: {
              title: titleEmbedding,
              description: descriptionEmbdding,
              images: imagesEmbedding,
            },
          },
        ],
      },
    );

    console.log('Update operation info:', operationInfo);
  }
}
