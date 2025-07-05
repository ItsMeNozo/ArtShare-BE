import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { ArtGenerationService } from 'src/art-generation/art-generation.service';
import { AspectRatio } from 'src/art-generation/enum/aspect-ratio';
import { ModelKey } from 'src/art-generation/image-generator.interface';
import { AutoPostMeta } from 'src/auto-project/dto/request/auto-post-meta.dto';
import { z } from 'zod';

export interface AutoPostSeedData {
  projectTitle: string;
  projectDescription: string;
}

export interface GeneratedAutoPost {
  content: string;
  imageUrls: string[];
  scheduledAt: Date;
}

const AutoPostConent = z.object({
  content: z.string(),
});

@Injectable()
export class AutoPostGenerateService {
  private readonly openai: OpenAI;
  aiCreditCost = 2;

  constructor(
    private readonly artGenerationService: ArtGenerationService,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_AI_SECRET_KEY'),
    });
  }

  async generateAutoPosts(
    meta: AutoPostMeta[],
    seedData: AutoPostSeedData,
    userId: string,
  ): Promise<GeneratedAutoPost[]> {
    const { projectTitle: title, projectDescription: description } =
      seedData;

    const tempResult = meta.map(async (item) => {
      const [generatedContent, generatedImages] = await Promise.all([
        this.generateContent(title, description),
        this.artGenerationService.generateImages(
          {
            modelKey: ModelKey.GPT_IMAGE,
            prompt: `Create visually engaging images for a social media post, each image should capture the core idea and emotion of the title and description:\nTitle: ${title}\nDescription: ${description}`,
            n: item.imagesCount,
            aspectRatio: AspectRatio.SQUARE,
          },
          userId,
        ),
      ]);

      return {
        content: generatedContent,
        imageUrls: generatedImages.imageUrls,
        scheduledAt: item.scheduledAt,
      } as GeneratedAutoPost;
    });

    return Promise.all(tempResult);
  }

  private async generateContent(
    title: string,
    description: string,
  ): Promise<string> {
    // 3. Call the OpenAI SDK
    const response = await this.openai.responses.parse({
      model: 'gpt-4.1-nano-2025-04-14',
      instructions:
        'Generate a well formatted, concise and engaging social media and post based on the following title and description. Make sure the content quite long, a few hundreds words is enough, and is formatted in HTML and CSS',
      input: `Title: ${title}\nDescription: ${description}`,
      text: {
        format: zodTextFormat(AutoPostConent, 'autoPostContent'),
      },
    });

    if (!response.output_parsed) {
      throw new Error('Failed to parse response');
    }

    const { content } = response.output_parsed;
    return content;
  }
}
