import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { plainToInstance } from 'class-transformer';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { TryCatch } from 'src/common/try-catch.decorator';
import embeddingConfig from 'src/config/embedding.config';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { PrismaService } from 'src/prisma.service';
import { UsageService } from 'src/usage/usage.service';
import { z } from 'zod';
import { PostCategoryResponseDto } from './dto/response/category.dto';
import { GeneratePostMetadataResponseDto } from './dto/response/generate-post-metadata.dto';

const PostMetadata = z.object({
  title: z.string(),
  description: z.string(),
});

@Injectable()
export class WorkflowAssistService {
  private readonly categoriesCollectionName: string;
  private readonly openai: OpenAI;
  aiCreditCost = 2;

  constructor(
    @Inject(embeddingConfig.KEY)
    private embeddingConf: ConfigType<typeof embeddingConfig>,
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantClient: QdrantClient,
    private readonly usageService: UsageService,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_AI_SECRET_KEY'),
    });

    this.categoriesCollectionName = this.embeddingConf.categoriesCollectionName;
  }

  @TryCatch()
  async generatePostMetadata(
    imageFiles: Express.Multer.File[],
    userId: string,
  ): Promise<GeneratePostMetadataResponseDto> {
    if (!imageFiles || imageFiles.length === 0) {
      throw new BadRequestException('No images provided');
    }

    await this.usageService.handleCreditUsage(
      userId,
      FeatureKey.AI_CREDITS,
      this.aiCreditCost,
    );

    const [{ title, description }, matchedCategories] = await Promise.all([
      this.generateTitleAndDescription(imageFiles),
      this.generateCategories(imageFiles),
    ]);

    // query categories based on the categories returned from generating
    const categories = await this.prismaService.category.findMany({
      where: {
        id: {
          in: matchedCategories.map((c) => c.id),
        },
      },
    });

    return {
      title: title,
      description: description,
      categories: plainToInstance(PostCategoryResponseDto, categories, {
        excludeExtraneousValues: true,
      }),
    };
  }

  private async generateTitleAndDescription(
    imageFiles: Express.Multer.File[],
  ): Promise<{ title: string; description: string }> {
    // 1. Map each file to an "input_image" object with a data URI
    const imageInputs = imageFiles.map((file) => ({
      type: 'input_image' as const,
      image_url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      detail: 'low' as const,
    }));

    // 2. Build the full input sequence, possibly prefacing with a prompt
    const inputSequence = [
      {
        role: 'system' as const,
        content:
          'You are helping a user generate a title and description for a social post based on the provided images.',
      },
      {
        role: 'user' as const,
        content: [
          // { type: 'input_text' as const, text: 'Please generate a title and description.' },
          ...imageInputs,
        ],
      },
    ];

    // 3. Call the OpenAI SDK
    const response = await this.openai.responses.parse({
      model: 'gpt-4.1-nano-2025-04-14',
      input: inputSequence,
      text: {
        format: zodTextFormat(PostMetadata, 'post_metadata'),
      },
    });

    if (!response.output_parsed) {
      throw new Error('Failed to parse response');
    }

    const { title, description } = response.output_parsed;
    return {
      title,
      description,
    };
  }

  private async generateCategories(
    imageFiles: Express.Multer.File[],
  ): Promise<{ id: number; name: string }[]> {
    const batchInput = await Promise.all(
      imageFiles.map(async (file) => {
        const queryEmbedding =
          await this.embeddingService.generateEmbeddingFromImageBlob(
            new Blob([file.buffer]),
          );
        return {
          prefetch: [
            {
              query: queryEmbedding,
              using: 'name',
            },
            {
              query: queryEmbedding,
              using: 'description',
            },
          ],
          query: {
            fusion: 'dbsf',
          },
          limit: 1,
          with_payload: true,
        };
      }),
    );

    const searchResponse = await this.qdrantClient.queryBatch(
      this.categoriesCollectionName,
      {
        searches: batchInput,
      },
    );
    console.dir(searchResponse, { depth: null });

    // extract id & name, then dedupe by id
    const allHits: { id: number; name: string }[] = searchResponse.flatMap(
      (r) =>
        r.points.map((p) => ({
          id: p.id as number,
          name: (p.payload?.name || '') as string,
        })),
    );
    const uniqueById = Array.from(
      new Map(allHits.map((hit) => [hit.id, hit])).values(),
    );

    return uniqueById;
  }
}
