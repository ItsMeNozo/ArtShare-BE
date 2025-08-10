import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { AutoPost } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { UsageService } from 'src/usage/usage.service';
import { z } from 'zod';
import { EditAutoPostContent } from './dto/request/edit-auto-post-content';
import { GenAutoPostsPayload } from './dto/request/gen-auto-posts-payload';

@Injectable()
export class AutoPostGenerateServiceV2 {
  private readonly openai: OpenAI;
  textCost = 2;
  private readonly MODEL: string = 'gpt-5-nano';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usageService: UsageService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_AI_SECRET_KEY'),
    });
  }

  async editAutoPostContent(payload: EditAutoPostContent): Promise<string> {
    const { seedPrompt } = payload;

    const instructions = `
      You are an expert social media content creator.
      Your task is to edit an existing social media post based on a prompt.
      The prompt could contain a short prompt or the existing content with or without additional context.
    `;

    const response = await this.openai.responses.parse({
      model: this.MODEL,
      instructions: instructions,
      input: seedPrompt,
      text: {
        format: zodTextFormat(AutoPostResponseSchema, 'editedPosts'),
      },
    });

    if (!response.output_parsed) {
      throw new InternalServerErrorException(
        'Failed to parse AI response. The response may be malformed.',
      );
    }

    return response.output_parsed.content;
  }

  async generateAutoPosts(
    payload: GenAutoPostsPayload,
    userId: string,
  ): Promise<AutoPost[]> {
    const { autoProjectId, postCount = 1 } = payload;

    await this.usageService.handleCreditUsage(
      userId,
      FeatureKey.AI_CREDITS,
      this.textCost,
    );

    const postContentList = await Promise.all(
      Array.from({ length: postCount }, () =>
        this.generateOneAutoPost(payload),
      ),
    );

    // save the generated posts to the database
    const posts = postContentList.map((content) => ({
      content,
      autoProjectId: autoProjectId,
      scheduledAt: new Date(),
    }));

    return await this.prisma.autoPost.createManyAndReturn({
      data: posts,
    });
  }

  async generateOneAutoPost(payload: GenAutoPostsPayload): Promise<string> {
    const {
      contentPrompt,
      wordCount = 100,
      toneOfVoice = 'informative',
      generateHashtag = true,
      includeEmojis = true,
    } = payload;
    const instructions = `
      You are an expert social media content creator. Your task is to generate a social media post based on the provided input topic.

      **Constraints and Style Guide:**
      - **Tone of Voice:** The post must have a ${toneOfVoice} tone.
      - **Length:** The post must have exactly ${wordCount} words.
      - **Emojis:** ${
        includeEmojis
          ? 'Use relevant emojis to make the posts engaging.'
          : 'Do not include any emojis.'
      }
      - **Hashtags:** ${
        generateHashtag
          ? 'Include a few relevant and popular hashtags at the end of each post.'
          : 'Do not include any hashtags.'
      }
    `;

    const response = await this.openai.responses.parse({
      model: this.MODEL,
      instructions: instructions,
      input: contentPrompt,
      text: {
        format: zodTextFormat(AutoPostResponseSchema, 'generatedPosts'),
      },
    });

    if (!response.output_parsed) {
      throw new InternalServerErrorException(
        'Failed to parse AI response. The response may be malformed.',
      );
    }

    return response.output_parsed.content;
  }
}

const AutoPostResponseSchema = z.object({
  content: z
    .string()
    .describe('The full text content of the social media post.'),
});
