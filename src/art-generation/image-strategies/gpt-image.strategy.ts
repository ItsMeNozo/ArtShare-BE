import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
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
    });
  }

  readonly modelKey = ModelKey.GPT_IMAGE;

  async generate(
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    this.logger.debug(
      `Generating image with options: ${JSON.stringify(options)}`,
    );

    let img;

    const commonOptions = {
      model: 'gpt-image-1',
      prompt: options.prompt,
      n: options.n,
      size: this.getImageSize(options.aspectRatio),
      quality: options.quality,
    };

    if (options.seedImage) {
      const imageFile = await toFile(options.seedImage.buffer, 'seed-image', {
        type: options.seedImage.mimetype,
      });
      img = await this.openai.images.edit({
        ...commonOptions,
        image: imageFile,
      });
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
}
