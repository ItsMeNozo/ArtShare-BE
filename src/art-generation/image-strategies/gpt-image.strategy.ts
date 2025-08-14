import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Agent as HttpsAgent } from 'https';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import sharp from 'sharp';
import { AspectRatio } from '../enum/aspect-ratio';
import {
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageGeneratorStrategy,
  ModelKey,
} from '../image-generator.interface';

@Injectable()
export class GptImageStrategy implements ImageGeneratorStrategy {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(GptImageStrategy.name);

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_AI_SECRET_KEY'),
      maxRetries: 0, // default is 2; silent backoff can add many seconds
      // timeout: 15_000, // hard cap per request (you can tune later)
      httpAgent: new HttpsAgent({ keepAlive: true }),
    });
  }

  readonly modelKey = ModelKey.GPT_IMAGE;

  async generate(
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    let img;

    const commonOptions = {
      model: 'gpt-image-1',
      prompt: options.prompt,
      n: options.n,
      size: this.getImageSize(options.aspectRatio),
      quality: options.quality,
    };

    if (options.seedImage) {
      const t1 = Date.now();
      const { out, filename, mime } = await this.preprocessFast(
        options.seedImage.buffer,
      );

      // 2) Wrap once (no disk I/O)
      const imageFile = await toFile(out, filename, {
        type: mime === 'image/*' ? options.seedImage.mimetype : mime,
      });
      img = await this.openai.images.edit({
        ...commonOptions,
        image: imageFile,
      });
      this.logger.debug(`openai this.openai.images.edit ms=${Date.now() - t1}`);
    } else {
      img = await this.openai.images.generate({
        ...commonOptions,
      });
    }

    if (!img.data || !img.data[0].b64_json) {
      throw new Error('Image data is undefined or invalid');
    }

    const b64EncodedImages = img.data
      .map((entry) => entry.b64_json)
      .filter((b64_json): b64_json is string => b64_json !== undefined);

    return { b64EncodedImages };
  }

  private getImageSize(
    aspectRatio: AspectRatio,
  ): 'auto' | '1024x1024' | '1536x1024' | '1024x1536' {
    switch (aspectRatio) {
      case AspectRatio.SQUARE:
        return '1024x1024';
      case AspectRatio.LANDSCAPE:
        return '1536x1024';
      case AspectRatio.PORTRAIT:
        return '1024x1536';
      default:
        return 'auto';
    }
  }

  shouldBypassReencode(meta: sharp.Metadata) {
    // If already small and not huge file size, skip re-encode for speed.
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    return w <= FAST_TARGET && h <= FAST_TARGET;
  }

  async preprocessFast(buffer: Buffer) {
    const meta = await sharp(buffer).metadata();

    if (this.shouldBypassReencode(meta)) {
      // Keep original if it's already small — avoids extra CPU time
      return { out: buffer, filename: 'seed-original', mime: 'image/*' };
    }

    // WebP typically smaller; use fastest settings (effort:0)
    const out = await sharp(buffer)
      .resize({
        width: FAST_TARGET,
        height: FAST_TARGET,
        fit: 'inside',
        withoutEnlargement: true,
        fastShrinkOnLoad: true,
      })
      .webp({
        quality: 75, // try 70–80
        effort: 0, // fastest encoding
        smartSubsample: true,
      })
      .toBuffer();

    return { out, filename: 'seed-image.webp', mime: 'image/webp' };
  }
}
const FAST_TARGET = 512;
