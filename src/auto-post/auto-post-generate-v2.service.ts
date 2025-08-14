import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import { Agent as HttpsAgent } from 'https';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { firstValueFrom } from 'rxjs';
import { FacebookAuthService } from 'src/auth/facebook/facebook.service';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { TryCatch } from 'src/common/try-catch.decorator';
import { AutoPost } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { UsageService } from 'src/usage/usage.service';
import { z } from 'zod';
import { EditAutoPostContent } from './dto/request/edit-auto-post-content';
import { GenAutoPostsPayload } from './dto/request/gen-auto-posts-payload';

@Injectable()
export class AutoPostGenerateServiceV2 {
  private readonly logger = new Logger(AutoPostGenerateServiceV2.name);
  private readonly openai: OpenAI;
  textCost = 2;
  private readonly MODEL: string = 'gpt-5-mini';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usageService: UsageService,
    private readonly facebookAuthService: FacebookAuthService,
    private readonly httpService: HttpService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_AI_SECRET_KEY'),
      maxRetries: 0, // default is 2; silent backoff can add many seconds
      // timeout: 15_000, // hard cap per request (you can tune later)
      httpAgent: new HttpsAgent({ keepAlive: true }),
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

  @TryCatch()
  async generateAutoPosts(
    payload: GenAutoPostsPayload,
    userId: string,
  ): Promise<AutoPost[]> {
    this.logger.log(
      `Generating posts for user ${userId} with payload: ${JSON.stringify(payload)}`,
    );

    const { autoProjectId, postCount = 1 } = payload;

    await this.usageService.handleCreditUsage(
      userId,
      FeatureKey.AI_CREDITS,
      this.textCost,
    );

    const postContentList = await Promise.all(
      Array.from({ length: postCount }, () =>
        this.generateOneAutoPost(payload, userId),
      ),
    );

    const posts = postContentList.map((content) => ({
      content,
      autoProjectId: autoProjectId,
      scheduledAt: new Date(),
    }));

    return await this.prisma.autoPost.createManyAndReturn({
      data: posts,
    });
  }

  @TryCatch()
  async generateOneAutoPost(
    payload: GenAutoPostsPayload,
    userId: string,
  ): Promise<string> {
    const {
      contentPrompt,
      wordCount = 100,
      toneOfVoice = 'informative',
      generateHashtag = true,
      includeEmojis = true,
      url,
    } = payload;

    let contextContent = '';

    if (url) {
      this.logger.log(`URL detected. Fetching content from: ${url}`);
      try {
        if (
          url.includes('facebook.com') ||
          url.includes('fb.com') ||
          url.includes('fb.watch')
        ) {
          this.logger.log('Facebook URL detected. Using FacebookAuthService.');
          contextContent = await this.facebookAuthService.getPostContentFromUrl(
            userId,
            url,
          );
        } else {
          this.logger.log('Generic URL detected. Using internal web scraper.');
          contextContent = await this.extractContentFromUrl(url);
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to fetch content from URL: ${url}`,
          error.stack,
        );

        if (error.message.includes('Could not parse a valid Post ID')) {
          throw new BadRequestException(
            'Invalid Facebook URL. Please provide a direct link to a specific post, photo, or video, not a profile page.',
          );
        }

        throw new InternalServerErrorException(
          `Failed to process URL content: ${error.message}`,
        );
      }
    }

    this.logger.log('contextContent', contextContent);

    const finalContentPrompt = contextContent
      ? `Using the following text as context: "${contextContent}".\n\nNow, do the following: ${contentPrompt}`
      : contentPrompt;

    const instructions = `
      You are an expert social media content creator. Your task is to generate a social media post based on the provided input topic.

      Constraints and Style Guide:
      - Tone of Voice: The post should have a ${toneOfVoice} tone
      - Length: The post should have around ${wordCount} words
      - Emojis: ${
        includeEmojis
          ? 'Use relevant emojis to make the posts engaging'
          : 'Do not include any emojis.'
      }
      - Hashtags: ${
        generateHashtag
          ? 'Include a few relevant and popular hashtags at the end of each post'
          : 'Do not include any hashtags'
      }
    `;

    const t1 = Date.now();
    const response = await this.openai.responses.create({
      model: this.MODEL,
      instructions: instructions,
      input: finalContentPrompt,
    });
    this.logger.debug(
      `openai this.openai.responses.create ms=${Date.now() - t1}`,
    );

    if (!response.output_text) {
      throw new InternalServerErrorException(
        'Failed to parse AI response. The response may be malformed.',
      );
    }

    return response.output_text;
  }

  private async extractContentFromUrl(url: string): Promise<string> {
    try {
      const response = await firstValueFrom(this.httpService.get(url));
      const $ = cheerio.load(response.data);

      $('script, style, head, nav, footer, aside, form, header').remove();

      const mainContent = $('body').text().trim().replace(/\s\s+/g, ' ');

      return mainContent.substring(0, 10000);
    } catch (error: any) {
      this.logger.error(`Error scraping URL ${url}`, error.stack);
      throw new Error(`Failed to retrieve or parse content from ${url}.`);
    }
  }
}

const AutoPostResponseSchema = z.object({
  content: z
    .string()
    .describe('The full text content of the social media post.'),
});
