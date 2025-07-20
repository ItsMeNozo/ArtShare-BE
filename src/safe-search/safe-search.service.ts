import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { TryCatch } from 'src/common/try-catch.decorator';
import { AdultDetectionResponseDto } from './dto/response/adult-detection.dto';
import {
  ISafeSearchAnnotation,
  Likelihood,
} from './types/safe-search-annotation.type';

@Injectable()
export class SafeSearchService {
  private client: ImageAnnotatorClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new ImageAnnotatorClient({
      apiKey: this.configService.get<string>('GOOGLE_VISION_API_KEY'),
    });
  }

  @TryCatch()
  async detectSafeSearchBatch(
    imageFiles: Express.Multer.File[],
  ): Promise<ISafeSearchAnnotation[]> {
    const requests = imageFiles.map(({ buffer }) => ({
      image: { content: buffer },
      features: [
        {
          type: protos.google.cloud.vision.v1.Feature.Type
            .SAFE_SEARCH_DETECTION,
        },
      ],
    }));

    const [batchResponse] = await this.client.batchAnnotateImages({
      requests,
    });

    return (batchResponse.responses ?? [])
      .map((r) => r.safeSearchAnnotation)
      .filter(
        (
          annotation,
        ): annotation is protos.google.cloud.vision.v1.ISafeSearchAnnotation =>
          annotation != null,
      );
  }

  @TryCatch()
  async detectAdultImages(
    imageFiles: Express.Multer.File[],
  ): Promise<AdultDetectionResponseDto[]> {
    const safeSearchAnnotations = await this.detectSafeSearchBatch(imageFiles);

    const response = safeSearchAnnotations.map((annotation) => {
      const annotationAdult = Likelihood[annotation.adult!];
      const isAdult =
        annotationAdult == Likelihood.VERY_LIKELY ||
        annotationAdult == Likelihood.LIKELY ||
        annotationAdult == Likelihood.POSSIBLE;

      return {
        isAdult,
        annotation,
      } as AdultDetectionResponseDto;
    });

    return plainToInstance(AdultDetectionResponseDto, response);
  }
}
