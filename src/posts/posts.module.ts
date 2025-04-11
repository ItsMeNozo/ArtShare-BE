import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { StorageService } from 'src/storage/storage.service';
import { S3StorageProvider } from 'src/storage/providers/s3-storage.provider';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    PostsService,
    StorageService,
    S3StorageProvider,
    EmbeddingService,
  ],
  controllers: [PostsController],
})
export class PostsModule {}
