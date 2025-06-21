import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { SyncEmbeddingResponseDto } from 'src/common/response/sync-embedding.dto';
import { TryCatch } from 'src/common/try-catch.decorator';
import embeddingConfig from 'src/config/embedding.config';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { QdrantService } from 'src/embedding/qdrant.service';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class BlogEmbeddingService {
  private readonly logger = new Logger(BlogEmbeddingService.name);
  private readonly blogsCollectionName: string;

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantClient: QdrantClient,
    private readonly qdrantService: QdrantService,
    private readonly prisma: PrismaService,
    @Inject(embeddingConfig.KEY)
    private embeddingConf: ConfigType<typeof embeddingConfig>,
  ) {
    this.blogsCollectionName = this.embeddingConf.blogsCollectionName;
  }

  @TryCatch()
  async upsertBlogEmbeddings(
    blogId: number,
    title: string,
    content: string,
  ): Promise<void> {
    const operationInfo = await this.qdrantClient.upsert(
      this.blogsCollectionName,
      {
        wait: true,
        points: [
          {
            id: blogId,
            vector: await this.buildVectorToCreate(title, content),
            payload: { blogId: blogId },
          },
        ],
      },
    );

    this.logger.log('Creating blog embeddings completed:', operationInfo);
  }

  private async buildVectorToCreate(
    title: string,
    content: string,
  ): Promise<Record<string, number[]>> {
    const [titleEmbedding, contentEmbedding] = await Promise.all([
      this.embeddingService.generateEmbeddingFromText(title),
      this.embeddingService.generateEmbeddingFromText(content),
    ]);
    return {
      title: titleEmbedding,
      content: contentEmbedding,
    };
  }

  @TryCatch()
  async updateBlogEmbeddings(
    blogId: number,
    newTitle?: string,
    newContent?: string,
  ): Promise<void> {
    const [titleEmbedding, contentEmbedding] = await Promise.all([
      newTitle
        ? this.embeddingService.generateEmbeddingFromText(newTitle)
        : Promise.resolve(null),
      newContent
        ? this.embeddingService.generateEmbeddingFromText(newContent)
        : Promise.resolve(null),
    ]);

    const vectorPayload: Record<string, number[]> = {};

    if (titleEmbedding) {
      vectorPayload.title = titleEmbedding;
    }
    if (contentEmbedding) {
      vectorPayload.content = contentEmbedding;
    }

    if (Object.keys(vectorPayload).length === 0) {
      this.logger.log(
        `No vectors to update for blog ${blogId}. Skipping update.`,
      );
      return;
    }

    const operationInfo = await this.qdrantClient.updateVectors(
      this.blogsCollectionName,
      {
        wait: true,
        points: [
          {
            id: blogId,
            vector: vectorPayload,
          },
        ],
      },
    );

    this.logger.log(
      `Blog with id ${blogId} has update its vectors: ${Object.keys(vectorPayload).join(', ')}`,
      operationInfo,
    );
  }

  @TryCatch()
  async syncBlogsEmbeddings(): Promise<SyncEmbeddingResponseDto> {
    return this.qdrantService._syncEmbeddingsForModel(
      this.blogsCollectionName,
      'blog',
      () => this.prisma.blog.findMany(),
      async (blog) => ({
        id: blog.id,
        vector: await this.buildVectorToCreate(blog.title, blog.content),
      }),
    );
  }
}
