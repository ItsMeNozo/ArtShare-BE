import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { AutoPost } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { UsageService } from 'src/usage/usage.service';
import { z } from 'zod';
import { GenAutoPostsPayload } from './dto/request/gen-auto-posts-payload';

@Injectable()
export class AutoPostGenerateServiceV2 {
  private readonly openai: OpenAI;
  textCost = 2;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usageService: UsageService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_AI_SECRET_KEY'),
    });
  }

  async generateAutoPosts(
    payload: GenAutoPostsPayload,
    userId: string,
  ): Promise<AutoPost[]> {
    const {
      autoProjectId,
      contentPrompt,
      postCount = 1,
      wordCount = 100,
      toneOfVoice = 'informative',
      generateHashtag = true,
      includeEmojis = true,
    } = payload;

    await this.usageService.handleCreditUsage(
      userId,
      FeatureKey.AI_CREDITS,
      this.textCost,
    );

    // The detailed instructions for the AI on how to format the output.
    const instructions = `
      You are an expert social media content creator. Your task is to generate ${postCount} distinct social media posts based on the provided input topic.

      **Constraints and Style Guide:**
      - **Tone of Voice:** The posts must have a ${toneOfVoice} tone.
      - **Length:** Each post should be approximately ${wordCount} words long.
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

      Generate a valid JSON object that strictly adheres to the provided schema.
      The output should be a single JSON object with a key "posts" which is an array of post objects.
    `;

    const response = await this.openai.responses.parse({
      model: 'gpt-4.1-nano-2025-04-14',
      instructions: instructions,
      input: contentPrompt,
      text: {
        format: zodTextFormat(AutoPostsResponseSchema, 'generatedPosts'),
      },
    });

    if (!response.output_parsed) {
      throw new InternalServerErrorException(
        'Failed to parse AI response. The response may be malformed.',
      );
    }

    // save the generated posts to the database
    const posts = response.output_parsed.posts.map((post) => ({
      content: post.content,
      auto_project_id: autoProjectId,
    }));

    return await this.prisma.autoPost.createManyAndReturn({
      data: posts,
    });
  }
}

const AutoPostsResponseSchema = z.object({
  posts: z.array(
    z.object({
      content: z
        .string()
        .describe('The full text content of the social media post.'),
    }),
  ),
});
