import { Module } from '@nestjs/common';
import { SemanticSearchController } from './semantic-search.controller';
import { SemanticSearchService } from './semantic-search.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [SemanticSearchController],
  providers: [SemanticSearchService, PrismaService]
})
export class SemanticSearchModule {}
