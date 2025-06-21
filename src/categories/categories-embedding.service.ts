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
export class CategoriesEmbeddingService {
  private readonly categoriesCollectionName: string;
  private readonly vectorDimension: number;
  private readonly logger = new Logger(CategoriesEmbeddingService.name);

  constructor(
    @Inject(embeddingConfig.KEY)
    private embeddingConf: ConfigType<typeof embeddingConfig>,
    private readonly qdrantService: QdrantService,
    private readonly qdrantClient: QdrantClient,
    private readonly embeddingService: EmbeddingService,
    private readonly prismaService: PrismaService,
  ) {
    this.categoriesCollectionName = this.embeddingConf.categoriesCollectionName;
    this.vectorDimension = this.embeddingConf.vectorDimension;
  }

  @TryCatch()
  async upsertCategoryEmbeddings(
    cateId: number,
    name: string,
    description: string,
  ): Promise<void> {
    const operationInfo = await this.qdrantClient.upsert(
      this.categoriesCollectionName,
      {
        wait: true,
        points: [
          {
            id: cateId,
            vector: await this.buildVectorToCreate(name, description),
            payload: {
              name: name,
              description: description,
            },
          },
        ],
      },
    );
    this.logger.log('Creating category embeddings completed:', operationInfo);
  }

  @TryCatch()
  async updateCategoryEmbeddings(
    cateId: number,
    name?: string,
    description?: string,
  ): Promise<void> {
    const [nameEmbedding, descriptionEmbedding] = await Promise.all([
      name
        ? this.embeddingService.generateEmbeddingFromText(name)
        : Promise.resolve(null),
      description
        ? this.embeddingService.generateEmbeddingFromText(description)
        : Promise.resolve(null),
    ]);

    const vectorPayload: Record<string, number[]> = {};
    if (nameEmbedding) {
      vectorPayload.name = nameEmbedding;
    }
    if (descriptionEmbedding) {
      vectorPayload.description = descriptionEmbedding;
    }
    if (Object.keys(vectorPayload).length === 0) {
      this.logger.warn(
        `No embeddings provided for category ID ${cateId}. Skipping update.`,
      );
      return;
    }
    const operationInfo = await this.qdrantClient.updateVectors(
      this.categoriesCollectionName,
      {
        wait: true,
        points: [
          {
            id: cateId,
            vector: vectorPayload,
          },
        ],
      },
    );
    this.logger.log(
      `Category with id ${cateId} has update its vectors: ${Object.keys(vectorPayload).join(', ')}`,
      operationInfo,
    );
  }

  private async buildVectorToCreate(
    name: string,
    description: string,
  ): Promise<Record<string, number[]>> {
    const [nameEmbedding, descriptionEmbedding] = await Promise.all([
      this.embeddingService.generateEmbeddingFromText(name),
      this.embeddingService.generateEmbeddingFromText(description),
    ]);
    return {
      name: nameEmbedding,
      description: descriptionEmbedding,
    };
  }

  @TryCatch()
  async syncCategoriesEmbeddings(): Promise<SyncEmbeddingResponseDto> {
    return this.qdrantService._syncEmbeddingsForModel(
      this.categoriesCollectionName,
      'categories',
      () => this.prismaService.category.findMany(),
      async (category) => {
        return {
          id: category.id,
          vector: await this.buildVectorToCreate(
            category.name,
            category.description,
          ),
          payload: {
            name: category.name,
            description: category.description,
          },
        };
      },
    );
  }

  async ensureCategoriesCollectionExists() {
    const collectionExists = await this.qdrantService.collectionExists(
      this.categoriesCollectionName,
    );
    if (!collectionExists) {
      await this.qdrantClient.createCollection(this.categoriesCollectionName, {
        vectors: {
          name: { size: this.vectorDimension, distance: 'Cosine' },
          description: { size: this.vectorDimension, distance: 'Cosine' },
        },
      });
      this.logger.log('Collection categories created successfully');
    }
  }
}
