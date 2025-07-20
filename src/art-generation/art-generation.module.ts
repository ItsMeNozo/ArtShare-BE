import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { S3StorageProvider } from 'src/storage/providers/s3-storage.provider';
import { StorageService } from 'src/storage/storage.service';
import { UsageModule } from 'src/usage/usage.module';
import { ArtGenerationController } from './art-generation.controller';
import { ArtGenerationService } from './art-generation.service';
import { ImageGeneratorStrategy } from './image-generator.interface';
import { GptImageStrategy } from './image-strategies/gpt-image.strategy';
import { PromptService } from './prompt.service';

@Module({
  imports: [AuthModule, UsageModule],
  controllers: [ArtGenerationController],
  providers: [
    ArtGenerationService,
    GptImageStrategy,
    {
      provide: 'IMAGE_GENERATORS',
      useFactory: (gpt: GptImageStrategy) => [gpt] as ImageGeneratorStrategy[],
      inject: [GptImageStrategy],
    },
    StorageService,
    S3StorageProvider,
    PromptService,
  ],
  exports: [ArtGenerationService],
})
export class ArtGenerationModule {}
