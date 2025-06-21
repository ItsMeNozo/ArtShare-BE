import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { EmbeddingModule } from 'src/embedding/embedding.module';
import { CategoriesEmbeddingService } from './categories-embedding.service';
import { CategoriesManagementService } from './categories-management.service';
import { CategoriesSearchService } from './categories-search.service';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [AuthModule, EmbeddingModule],
  controllers: [CategoriesController],
  providers: [
    CategoriesSearchService,
    CategoriesManagementService,
    CategoriesEmbeddingService,
  ],
})
export class CategoriesModule {}
