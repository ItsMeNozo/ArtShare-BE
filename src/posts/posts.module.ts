import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PrismaService } from 'src/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { S3StorageProvider } from 'src/storage/providers/s3-storage.provider';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { Auth } from 'firebase-admin/lib/auth/auth';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    PostsService,
    PrismaService,
    StorageService,
    S3StorageProvider,
    EmbeddingService,
  ],
  controllers: [PostsController],
})
export class PostsModule {}
