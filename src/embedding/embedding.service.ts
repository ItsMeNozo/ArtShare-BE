import { Injectable } from '@nestjs/common';
// import axios from 'axios';
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPVisionModelWithProjection,
  CLIPTextModelWithProjection,
  RawImage,
  PretrainedOptions
} from '@xenova/transformers';

@Injectable()
export class EmbeddingService {
  private processorPromise;
  private visionModelPromise;
  private tokenizerPromise;
  private textModelPromise;

  constructor() {
    const modelName = 'Xenova/clip-vit-base-patch16';

    this.processorPromise = AutoProcessor.from_pretrained(modelName);
    this.visionModelPromise = CLIPVisionModelWithProjection.from_pretrained(modelName);

    this.tokenizerPromise = AutoTokenizer.from_pretrained(modelName);
    this.textModelPromise = CLIPTextModelWithProjection.from_pretrained(modelName);
  }

  async generateEmbeddingFromText(text: string): Promise<number[]> {
    const tokenizer = await this.tokenizerPromise;
    const textModel = await this.textModelPromise;

    const textInputs = tokenizer([text], { padding: true, truncation: true });
    const { text_embeds } = await textModel(textInputs);

    return Object.values(text_embeds.data)
  }

  async generateEmbeddingFromImage(image_url: string): Promise<number[]> {

    const processor = await this.processorPromise
    const visionModel = await this.visionModelPromise
    try {
      // Read image and run processor
      const image = await RawImage.read(image_url);
      const image_inputs = await processor(image);
      // Compute embeddings
      const { image_embeds } = await visionModel(image_inputs);

      return Object.values(image_embeds.data)

    } catch (err) {
      console.error(`Error processing ${image_url}:`, err);
      return [];
    }
  }

  async generateCombinedEmbedding(inputs: CombinedEmbeddingInput[]): Promise<number[]> {
    const embeddings: number[][] = [];

    for (const input of inputs) {
      let embedding: number[];

      switch (input.type) {
        case 'text':
          embedding = await this.generateEmbeddingFromText(input.value);
          break;
        case 'image':
          embedding = await this.generateEmbeddingFromImage(input.value);
          break;
        default:
          continue;
      }

      embeddings.push(embedding.map(val => val * input.weight));
    }

    return embeddings.reduce((acc, curr) => acc.map((val, idx) => val + curr[idx]));
  }
}

export class CombinedEmbeddingInput {
  type: EmbeddingType;
  value: string;
  weight: number;
}

export enum EmbeddingType {
  text = 'text',
  image = 'image',
}