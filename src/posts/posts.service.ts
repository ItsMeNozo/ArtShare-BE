import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/post-request.dto';
import {
  CreatePostResponseDto,
  PostDetailsResponseDto,
  UpdatePostResponseDto,
} from './dto/post-response.dto';
import { plainToInstance } from 'class-transformer';
import { StorageService } from 'src/storage/storage.service';
import { EmbeddingService, EmbeddingType } from 'src/embedding/embedding.service';
import { Media, Post } from '@prisma/client';
import { QdrantClient } from "@qdrant/js-client-rest";

const client = new QdrantClient({ host: "localhost", port: 6333 });

export class VectorParams {
  title?: number[]
  description?: number[];
  images: number[][];
}

@Injectable()
export class PostsService {
  private readonly qdrantCollectionName = 'posts';
  private qdrantClient = new QdrantClient({ url: process.env.QDRANT_URL, port: 6333, apiKey: process.env.QDRANT_API_KEY });

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly embeddingService: EmbeddingService
  ) { }

  async createPost(
    createPostDto: CreatePostDto,
    userId: number,
  ): Promise<CreatePostResponseDto> {
    const { cate_ids, medias_data, ...postData } = createPostDto;

    const post = await this.prisma.post.create({
      data: {
        user_id: userId,
        ...postData,
        medias: {
          create: medias_data.map(({ url, media_type }) => ({
            media_type,
            url,
            creator_id: userId,
          })),
        },
        categories: {
          connect: (cate_ids || []).map((cate_id) => ({ cate_id })),
        },
      },
      include: { medias: true, user: true, categories: true },
    });

    await this.savePostEmbedding(post);
    return plainToInstance(CreatePostResponseDto, post);
  }

  private async getVectorParams(post: Post & { medias: Media[] }): Promise<VectorParams> {
    if (!post.medias || post.medias.length === 0) {
      throw new Error('Post must have at least one media');
    }

    const [titleEmbedding, descriptionEmbedding, imageEmbeddings] = await Promise.all([
      post.title ? this.embeddingService.generateEmbeddingFromText(post.title) : undefined,
      post.description ? this.embeddingService.generateEmbeddingFromText(post.description) : undefined,
      Promise.all(post.medias.map((media) => this.embeddingService.generateEmbeddingFromImage(media.url))),
    ]);

    return {
      title: titleEmbedding,
      description: descriptionEmbedding,
      images: imageEmbeddings,
    };
  }

  private async savePostEmbedding(post: Post & { medias: Media[] }): Promise<void> {
    const { title, description, images } = await this.getVectorParams(post);

    try {
      const operationInfo = await this.qdrantClient.upsert(this.qdrantCollectionName, {
        wait: true,
        points: [
          {
            id: post.id,
            vector: {
              title: title,
              description: description,
              images: images,
            },
            payload: { postId: post.id },
          },
        ],
      });

      console.log('Upsert operation info:', operationInfo);
    } catch (error) {
      console.error('Failed to save embedding to Qdrant:', error);
      throw new Error('Failed to save embedding to Qdrant');
    }
  }

  async updatePostEmbedding(post: Post & { medias: Media[] }): Promise<void> {
    const { title, description, images } = await this.getVectorParams(post);

    try {
      const operationInfo = await this.qdrantClient.updateVectors(this.qdrantCollectionName, {
        points: [
          {
            id: post.id,
            vector: {
              title: title,
              description: description,
              images: images,
            },
          },
        ],
      });
    } catch (error) {
      console.error('Failed to update embedding in Qdrant:', error);
      throw new Error('Failed to update embedding in Qdrant');
    }
  }

  async updatePost(
    postId: number,
    updatePostDto: UpdatePostDto,
    userId: number,
  ): Promise<UpdatePostResponseDto> {
    const existingPost = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { medias: true },
    });

    if (!existingPost) {
      throw new NotFoundException('Post not found');
    }

    const { cate_ids, medias_data, ...postData } = updatePostDto;
    const newMediaProvided = medias_data && medias_data.length > 0;

    if (newMediaProvided) {
      await this.prisma.media.deleteMany({ where: { post_id: postId } });
      this.savePostEmbedding
    }

    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: {
        ...postData,
        categories: {
          set: (cate_ids || []).map((cate_id) => ({ cate_id })),
        },
        ...(newMediaProvided && {
          medias: {
            create: medias_data.map(({ url, media_type }) => ({
              media_type,
              url,
              creator_id: userId,
            })),
          },
        }),
      },
      include: { medias: true, user: true, categories: true },
    });

    return plainToInstance(UpdatePostResponseDto, updatedPost);
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
        post.medias.map((media) => this.storageService.deleteFile(media.url))
      );
    }

    return this.prisma.post.delete({ where: { id: postId } });
  }

  async getForYouPosts(userId: number): Promise<Post[]> {
    return this.prisma.post.findMany({
      where: { is_published: true },
      orderBy: { share_count: 'desc' },
      take: 10,
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

  async getFollowingPosts(userId: number, filter?: string): Promise<Post[]> {
    // Note: This is a placeholder. You may want to adjust the query to fetch posts from followed users.
    return this.prisma.post.findMany({
      where: {
        is_published: true,
        user: { id: userId },
      },
      orderBy: { created_at: 'desc' },
      include: { medias: true },
      take: 10,
    });
  }

  async searchPosts(query: string): Promise<(Post | undefined)[]> {
    const queryEmbedding = await this.embeddingService.generateEmbeddingFromText(query);

    try {
      const searchResponse = await this.qdrantClient.query(this.qdrantCollectionName, {
        prefetch: [
          {
            query: queryEmbedding,
            using: "images"
          },
          {
            query: queryEmbedding,
            using: "description"
          },
          {
            query: queryEmbedding,
            using: "title"
          }
        ],
        query: {
          fusion: "dbsf",
          limit: 10,
        }
        // with_payload: true,
      });

      console.log('Search response:', searchResponse.points);

      const pointIds: number[] = searchResponse.points.map(point => Number(point.id));

      const posts = await this.prisma.post.findMany({
        where: { id: { in: pointIds } },
        include: { medias: true, user: true, categories: true },
      });

      // Sort posts in the same order as returned by Qdrant
      const sortedPosts = pointIds.map((id) => posts.find((post) => post.id === id));
      return sortedPosts;
    } catch (error) {
      console.error('Error searching Qdrant:', error);
      throw new Error('Failed to search Qdrant');
    }
  }
}
