import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ArtGenerationModule } from 'src/art-generation/art-generation.module';
import { AuthModule } from 'src/auth/auth.module';
import { EncryptionModule } from 'src/encryption/encryption.module';
import { StorageModule } from 'src/storage/storage.module';
import { UsageModule } from 'src/usage/usage.module';
import { AutoPostGenerateServiceV2 } from './auto-post-generate-v2.service';
import { AutoPostGenerateService } from './auto-post-generate.service';
import { AutoPostController } from './auto-post.controller';
import { AutoPostScheduler } from './auto-post.scheduler';
import { AutoPostService } from './auto-post.service';

@Module({
  imports: [
    ArtGenerationModule,
    HttpModule,
    EncryptionModule,
    AuthModule,
    UsageModule,
    StorageModule,
  ],
  controllers: [AutoPostController],
  providers: [
    AutoPostService,
    AutoPostGenerateService,
    AutoPostGenerateServiceV2,
    AutoPostScheduler,
  ],
})
export class AutoPostModule {}
