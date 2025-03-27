import { Injectable } from '@nestjs/common';
// import axios from 'axios';
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPVisionModelWithProjection,
  CLIPTextModelWithProjection,
  RawImage,
} from '@xenova/transformers';
import { TryCatch } from 'src/common/try-catch.decorator.';

@Injectable()
export class EmbeddingService {
  private processorPromise;
  private visionModelPromise;
  private tokenizerPromise;
  private textModelPromise;

  constructor() {
    const modelName = 'Xenova/clip-vit-base-patch16';

    this.processorPromise = AutoProcessor.from_pretrained(modelName);
    this.visionModelPromise =
      CLIPVisionModelWithProjection.from_pretrained(modelName);

    this.tokenizerPromise = AutoTokenizer.from_pretrained(modelName);
    this.textModelPromise =
      CLIPTextModelWithProjection.from_pretrained(modelName);
  }

  async generateEmbeddingFromText(text: string): Promise<number[]> {
    const tokenizer = await this.tokenizerPromise;
    const textModel = await this.textModelPromise;

    const textInputs = tokenizer([text], { padding: true, truncation: true });
    const { text_embeds } = await textModel(textInputs);

    return Object.values(text_embeds.data);
  }

  async generateEmbeddingFromImageUrl(image_url: string): Promise<number[]> {
    const processor = await this.processorPromise;
    const visionModel = await this.visionModelPromise;
    try {
      // Read image and run processor
      const image = await RawImage.read(image_url);
      const image_inputs = await processor(image);
      // Compute embeddings
      const { image_embeds } = await visionModel(image_inputs);

      return Object.values(image_embeds.data);
    } catch (err) {
      console.error(`Error processing ${image_url}:`, err);
      return [];
    }
  }

  @TryCatch()
  async generateEmbeddingFromImageBlob(imageBlob: Blob): Promise<number[]> {
    const processor = await this.processorPromise;
    const visionModel = await this.visionModelPromise;

    const image_inputs = await processor(await RawImage.fromBlob(imageBlob));

    const { image_embeds } = await visionModel(image_inputs);

    return Object.values(image_embeds.data);
  }
}
