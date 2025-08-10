import { AspectRatio } from './enum/aspect-ratio';

export interface ImageGeneratorStrategy {
  readonly modelKey: ModelKey;
  generate(options: ImageGenerationOptions): Promise<ImageGenerationResult>;
}

export enum ModelKey {
  GPT_IMAGE = 'gpt-image-1',
}

export type ImageGenerationResult = {
  b64EncodedImages: string[];
};

export type ImageGenerationOptions = {
  prompt: string;
  n: number;
  aspectRatio: AspectRatio;
  quality: 'low' | 'medium' | 'high';
  seedImage?: Express.Multer.File;
};
