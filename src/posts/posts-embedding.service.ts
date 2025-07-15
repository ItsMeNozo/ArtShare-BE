import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { SyncEmbeddingResponseDto } from 'src/common/response/sync-embedding.dto';
import { TryCatch } from 'src/common/try-catch.decorator';
import embeddingConfig from 'src/config/embedding.config';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { QdrantService } from 'src/embedding/qdrant.service';
import { MediaType } from 'src/generated';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PostsEmbeddingService {
  private readonly logger = new Logger(PostsEmbeddingService.name);
  private readonly postsCollectionName: string;

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantClient: QdrantClient,
    private readonly qdrantService: QdrantService,
    private readonly prisma: PrismaService,
    @Inject(embeddingConfig.KEY)
    private embeddingConf: ConfigType<typeof embeddingConfig>,
  ) {
    this.postsCollectionName = this.embeddingConf.postsCollectionName;
  }

  @TryCatch()
  async upsertPostEmbedding(
    postId: number,
    title: string,
    description: string | undefined,
    imageFiles: Express.Multer.File[],
  ): Promise<void> {
    const [titleEmbedding, descriptionEmbedding, imagesEmbedding] =
      await Promise.all([
        this.embeddingService.generateEmbeddingFromText(title),

        description
          ? this.embeddingService.generateEmbeddingFromText(description)
          : Promise.resolve(null),

        imageFiles?.length > 0
          ? Promise.all(
              imageFiles.map((image) =>
                this.embeddingService.generateEmbeddingFromImageBlob(
                  new Blob([image.buffer]),
                ),
              ),
            ).then((embeds) => this.averageEmbeddings(embeds))
          : Promise.resolve(null),
      ]);

    const vectorPayload: Record<string, number[]> = {
      title: titleEmbedding,
    };
    if (descriptionEmbedding) {
      vectorPayload.description = descriptionEmbedding;
    }
    if (imagesEmbedding) {
      vectorPayload.images = imagesEmbedding;
    }

    const operationInfo = await this.qdrantClient.upsert(
      this.postsCollectionName,
      {
        wait: true,
        points: [
          {
            id: postId,
            vector: vectorPayload,
          },
        ],
      },
    );

    this.logger.log('Creating post embeddings completed', operationInfo);
  }

  @TryCatch()
  async updatePostEmbedding(
    postId: number,
    newTitle?: string,
    newDescription?: string,
    newImageUrls?: string[],
  ): Promise<void> {
    await Promise.all([
      this.updateVectors(postId, newTitle, newDescription, newImageUrls),
      this.deleteVectors(postId, newDescription, newImageUrls),
    ]);

    this.logger.log('Updated post embeddings completed');
  }

  async updateVectors(
    postId: number,
    newTitle?: string,
    newDescription?: string,
    newImageUrls?: string[],
  ) {
    const vectorPayload = await this.buildVectorPayload(
      newTitle,
      newDescription,
      newImageUrls,
    );

    if (Object.keys(vectorPayload).length === 0) {
      this.logger.log(
        `No vectors to update for post ${postId}. Skipping update.`,
      );
      return;
    }

    const operationInfo = await this.qdrantClient.updateVectors(
      this.postsCollectionName,
      {
        wait: true,
        points: [
          {
            id: postId,
            vector: vectorPayload,
          },
        ],
      },
    );

    this.logger.log(
      `Post with id ${postId} has update its vectors`,
      operationInfo,
    );
  }

  private async buildVectorPayload(
    title?: string,
    description?: string,
    imageUrls?: string[],
  ): Promise<Record<string, number[]>> {
    const [titleEmbedding, descriptionEmbedding, imagesEmbedding] =
      await Promise.all([
        title
          ? await this.embeddingService.generateEmbeddingFromText(title)
          : Promise.resolve(null),

        description && description.trim().length > 0
          ? this.embeddingService.generateEmbeddingFromText(description)
          : Promise.resolve(null),

        imageUrls && imageUrls.length > 0
          ? Promise.all(
              imageUrls.map((url) =>
                this.embeddingService.generateEmbeddingFromImageUrl(url),
              ),
            ).then((embeds) => this.averageEmbeddings(embeds))
          : Promise.resolve(null),
      ]);

    const vectorPayload: Record<string, number[]> = {};

    if (titleEmbedding) {
      vectorPayload.title = titleEmbedding;
    }
    if (descriptionEmbedding) {
      vectorPayload.description = descriptionEmbedding;
    }
    if (imagesEmbedding) {
      vectorPayload.images = imagesEmbedding;
    }
    return vectorPayload;
  }

  async deleteVectors(
    postId: number,
    newDescription?: string,
    newImageUrls?: string[],
  ) {
    const vectorsToDelete = [];
    if (newDescription !== undefined && newDescription.trim() === '') {
      vectorsToDelete.push('description');
    }
    if (newImageUrls && newImageUrls.length === 0) {
      vectorsToDelete.push('images');
    }

    if (vectorsToDelete.length === 0) {
      this.logger.log(
        `No vectors to delete for post ${postId}. Skipping deletion.`,
      );
      return;
    }

    const operationInfo = await this.qdrantClient.deleteVectors(
      this.postsCollectionName,
      {
        wait: true,
        points: [postId],
        vector: vectorsToDelete,
      },
    );

    this.logger.log(
      `Post with id ${postId} has delete vectors ${vectorsToDelete.join(', ')}`,
      operationInfo,
    );
  }

  private averageEmbeddings(embeddings: number[][]): number[] {
    if (!embeddings || embeddings.length === 0) return []; // handle empty case safely
    const length = embeddings[0].length;
    const sum = new Array(length).fill(0);
    embeddings.forEach((vec) => {
      for (let i = 0; i < length; i++) {
        sum[i] += vec[i];
      }
    });
    return sum.map((val) => val / embeddings.length);
  }

  @TryCatch()
  async syncPostsEmbeddings(): Promise<SyncEmbeddingResponseDto> {
    return this.qdrantService._syncEmbeddingsForModel(
      this.postsCollectionName,
      'post',
      () => this.prisma.post.findMany({ include: { medias: true } }),
      async (post) => ({
        id: post.id,
        vector: await this.buildVectorPayload(
          post.title,
          post.description ?? undefined,
          post.medias
            .filter((m) => m.mediaType === MediaType.image)
            .map((m) => m.url),
        ),
      }),
    );
  }
}
