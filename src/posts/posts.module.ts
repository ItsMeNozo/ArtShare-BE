import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { EmbeddingModule } from 'src/embedding/embedding.module';
import { LikesModule } from 'src/likes/likes.module';
import { LikesService } from 'src/likes/likes.service';
import { S3StorageProvider } from 'src/storage/providers/s3-storage.provider';
import { StorageService } from 'src/storage/storage.service';
import { UsageModule } from 'src/usage/usage.module';
import { UserModule } from 'src/user/user.module';
import { PostsAdminService } from './posts-admin.service';
import { PostsEmbeddingService } from './posts-embedding.service';
import { PostsExploreService } from './posts-explore.service';
import { PostsManagementService } from './posts-management.service';
import { PostsController } from './posts.controller';
import { PostsManagementValidator } from './validator/posts-management.validator';
import { WorkflowAssistService } from './workflow-assist.service';
import { PostsQueryBuilder } from './utils/posts-query-builder';

@Module({
  imports: [AuthModule, EmbeddingModule, LikesModule, UsageModule, UserModule],
  providers: [
    PostsExploreService,
    PostsQueryBuilder,
    PostsManagementService,
    StorageService,
    S3StorageProvider,
    WorkflowAssistService,
    PostsEmbeddingService,
    LikesService,
    PostsManagementValidator,
    PostsAdminService,
  ],
  controllers: [PostsController],
})
export class PostsModule {}
