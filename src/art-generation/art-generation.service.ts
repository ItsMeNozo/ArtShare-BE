import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { nanoid } from 'nanoid';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { AspectRatio } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { FileUploadResponse } from 'src/storage/dto/response.dto';
import { StorageService } from 'src/storage/storage.service';
import { SubscriptionPlan } from 'src/subscription/dto/response/subscription-info.dto';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { UsageService } from 'src/usage/usage.service';
import { ImageGenerationDto } from './dto/request/image-generation.dto';
import { ImageGenerationResponseDto } from './dto/response/image-generation.dto';
import {
  ImageGenerationResult,
  ImageGeneratorStrategy,
  ModelKey,
} from './image-generator.interface';

@Injectable()
export class ArtGenerationService {
  private readonly strategies: Record<ModelKey, ImageGeneratorStrategy>;
  private creditCostPerImage = 5;

  constructor(
    @Inject('IMAGE_GENERATORS')
    private readonly generators: ImageGeneratorStrategy[],
    private readonly storageService: StorageService,
    private readonly prismaService: PrismaService,
    private readonly usageService: UsageService,
    private readonly subscriptionService: SubscriptionService,
  ) {
    this.strategies = Object.fromEntries(
      this.generators.map(
        (g) => [g.modelKey, g] as [ModelKey, ImageGeneratorStrategy],
      ),
    ) as Record<ModelKey, ImageGeneratorStrategy>;
  }

  async generateImages(
    dto: ImageGenerationDto,
    userId: string,
    seedImage?: Express.Multer.File,
  ): Promise<ImageGenerationResponseDto> {
    const { modelKey, prompt, n, aspectRatio } = dto;

    if (n <= 0) {
      // return empty response
      return plainToInstance(ImageGenerationResponseDto, {
        userId: userId,
        userPrompt: prompt,
        finalPrompt: this.getFinalPrompt(
          prompt,
          dto.style,
          dto.lighting,
          dto.camera,
        ),
        modelKey: modelKey,
        numberOfImagesGenerated: 0,
        imageUrls: [],
        aspectRatio: aspectRatio,
        style: dto.style,
        lighting: dto.lighting,
        camera: dto.camera,
      });
    }

    await this.usageService.handleCreditUsage(
      userId,
      FeatureKey.AI_CREDITS,
      this.creditCostPerImage * n +
        (aspectRatio === AspectRatio.LANDSCAPE ||
        aspectRatio === AspectRatio.PORTRAIT
          ? 1
          : 0), // extra cost for landscape/portrait
    );

    const subInfo = await this.subscriptionService.getSubscriptionInfo(userId);

    // get the model based on the modelKey
    const strat = this.strategies[modelKey];
    if (!strat) {
      throw new BadRequestException(
        `Unknown model "${modelKey}". Supported: ${Object.values(ModelKey).join(', ')}`,
      );
    }
    // generate the image
    const finalPrompt: string = this.getFinalPrompt(
      prompt,
      dto.style,
      dto.lighting,
      dto.camera,
    );
    const imageGenerationResult: ImageGenerationResult = await strat.generate({
      prompt: finalPrompt,
      n,
      aspectRatio,
      seedImage,
      quality: this.getImageQuality(subInfo.plan),
    });

    if (!imageGenerationResult || !imageGenerationResult.b64EncodedImages) {
      throw new BadRequestException('Image generation failed');
    }
    const { b64EncodedImages } = imageGenerationResult;

    // save the images to storage
    const files: Express.Multer.File[] = b64EncodedImages.map((b64) => {
      const buffer = Buffer.from(b64, 'base64');
      return {
        fieldname: 'file',
        originalname: `${nanoid()}.png`,
        encoding: '7bit',
        mimetype: 'image/png',
        buffer,
        size: buffer.length,
      } as Express.Multer.File;
    });
    const uploads: FileUploadResponse[] = await this.storageService.uploadFiles(
      files,
      'generated-images',
    );

    const urls = uploads.map((upload) => upload.url);

    // save info to the database
    const generatedArt = await this.prismaService.artGeneration.create({
      data: {
        userId: userId,
        userPrompt: prompt,
        finalPrompt: finalPrompt,
        modelKey: modelKey,
        numberOfImagesGenerated: n,
        imageUrls: urls,
        aspectRatio: aspectRatio,
        style: dto.style,
        lighting: dto.lighting,
        camera: dto.camera,
      },
    });

    return plainToInstance(ImageGenerationResponseDto, generatedArt);
  }

  private getImageQuality(plan: SubscriptionPlan): 'low' | 'medium' | 'high' {
    switch (plan) {
      case SubscriptionPlan.FREE:
        return 'low';
      case SubscriptionPlan.ARTIST_PRO:
        return 'medium';
      case SubscriptionPlan.STUDIO:
        return 'high';
      case SubscriptionPlan.ENTERPRISE:
        return 'high';
      default:
        return 'low';
    }
  }

  private getFinalPrompt(
    prompt: string,
    style?: string,
    lighting?: string,
    camera?: string,
  ): string {
    const parts: string[] = [prompt];
    if (style) {
      parts.push(`in the style of ${style}`);
    }
    if (lighting) {
      parts.push(`with ${lighting} lighting`);
    }
    // camera meaning camera angle
    if (camera) {
      parts.push(`taken from a ${camera} angle`);
    }
    return parts.join(', ');
  }
}
