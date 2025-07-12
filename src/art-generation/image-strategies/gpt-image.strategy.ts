import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import OpenAI from 'openai';
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

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_AI_SECRET_KEY'),
    });
  }

  readonly modelKey = ModelKey.GPT_IMAGE;

  async generate(
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    const img = await this.openai.images.generate({
      model: 'gpt-image-1',
      prompt: options.prompt,
      n: options.n,
      size: this.getImageSize(options.aspectRatio),
      quality: 'low',
    });

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
