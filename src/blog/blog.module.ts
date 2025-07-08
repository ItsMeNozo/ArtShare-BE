import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { EmbeddingModule } from 'src/embedding/embedding.module';
import { LikesModule } from 'src/likes/likes.module';
import { BlogEmbeddingService } from './blog-embedding.service';
import { BlogExploreService } from './blog-explore.service';
import { BlogManagementService } from './blog-management.service';
import { BlogController } from './blog.controller';

@Module({
  imports: [AuthModule, EmbeddingModule, LikesModule],
  providers: [BlogManagementService, BlogExploreService, BlogEmbeddingService],
  controllers: [BlogController],
})
export class BlogModule {}
