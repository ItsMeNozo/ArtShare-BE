import { Injectable, Logger } from '@nestjs/common';
import { TryCatch } from 'src/common/try-catch.decorator';

import type {
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  PreTrainedTokenizer,
  Processor,
  RawImage,
} from '@xenova/transformers';

type RawImageClass = typeof RawImage;

@Injectable()
export class EmbeddingService {
  public processor: Processor;
  public visionModel: CLIPVisionModelWithProjection;
  public tokenizer: PreTrainedTokenizer;
  public textModel: CLIPTextModelWithProjection;
  private RawImage: RawImageClass;

  private readonly logger = new Logger(EmbeddingService.name);

  async onModuleInit() {
    this.logger.log('onModuleInit: Starting to initialize embedding models...');

    const {
      AutoProcessor,
      CLIPVisionModelWithProjection,
      AutoTokenizer,
      CLIPTextModelWithProjection,
      RawImage,
    } = await new Function('return import("@xenova/transformers")')();

    const modelName = 'Xenova/clip-vit-large-patch14';

    this.RawImage = RawImage;

    const [processor, visionModel, tokenizer, textModel] = await Promise.all([
      AutoProcessor.from_pretrained(modelName),
      CLIPVisionModelWithProjection.from_pretrained(modelName),
      AutoTokenizer.from_pretrained(modelName),
      CLIPTextModelWithProjection.from_pretrained(modelName),
    ]);

    this.processor = processor;
    this.visionModel = visionModel;
    this.tokenizer = tokenizer;
    this.textModel = textModel;

    this.logger.log('Embedding models initialized and ready to use.');
  }

  async generateEmbeddingFromText(text: string): Promise<number[]> {
    const textInputs = this.tokenizer([text], {
      padding: true,
      truncation: true,
    });
    const { text_embeds } = await this.textModel(textInputs);

    return Array.from(text_embeds.data);
  }

  async generateEmbeddingFromImageUrl(image_url: string): Promise<number[]> {
    try {
      const image = await this.RawImage.read(image_url);
      const image_inputs = await this.processor(image);
      const { image_embeds } = await this.visionModel(image_inputs);

      return Array.from(image_embeds.data);
    } catch (err) {
      this.logger.error(`Error processing ${image_url}:`, err);
      return [];
    }
  }

  @TryCatch()
  async generateEmbeddingFromImageBlob(imageBlob: Blob): Promise<number[]> {
    const image = await this.RawImage.fromBlob(imageBlob);
    const image_inputs = await this.processor(image);
    const { image_embeds } = await this.visionModel(image_inputs);

    return Array.from(image_embeds.data);
  }
}
