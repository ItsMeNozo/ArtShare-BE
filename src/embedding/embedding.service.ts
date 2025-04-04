import { Injectable } from '@nestjs/common';
import { TryCatch } from 'src/common/try-catch.decorator.';

@Injectable()
export class EmbeddingService {
  private processorPromise;
  private visionModelPromise;
  private tokenizerPromise;
  private textModelPromise;

  constructor() {
    const modelName = 'Xenova/clip-vit-base-patch16';

    // Use Function constructor to ensure ESM import is not transformed to require()
    const importTransformers = () =>
      Function('return import("@xenova/transformers")')();

    this.processorPromise = importTransformers().then(
      (module: { AutoProcessor: { from_pretrained: (arg0: string) => any } }) =>
        module.AutoProcessor.from_pretrained(modelName),
    );
    this.visionModelPromise = importTransformers().then(
      (module: {
        CLIPVisionModelWithProjection: {
          from_pretrained: (arg0: string) => any;
        };
      }) => module.CLIPVisionModelWithProjection.from_pretrained(modelName),
    );
    this.tokenizerPromise = importTransformers().then(
      (module: { AutoTokenizer: { from_pretrained: (arg0: string) => any } }) =>
        module.AutoTokenizer.from_pretrained(modelName),
    );
    this.textModelPromise = importTransformers().then(
      (module: {
        CLIPTextModelWithProjection: { from_pretrained: (arg0: string) => any };
      }) => module.CLIPTextModelWithProjection.from_pretrained(modelName),
    );
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
      const { RawImage } = await Function(
        'return import("@xenova/transformers")',
      )();
      const image = await RawImage.read(image_url);
      const image_inputs = await processor(image);
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

    const { RawImage } = await Function(
      'return import("@xenova/transformers")',
    )();
    const image_inputs = await processor(await RawImage.fromBlob(imageBlob));
    const { image_embeds } = await visionModel(image_inputs);

    return Object.values(image_embeds.data);
  }
}
