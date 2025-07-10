import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { EmbeddingService } from './embedding.service';
import { QdrantService } from './qdrant.service';

@Module({
  imports: [ConfigModule],
  providers: [
    EmbeddingService,
    QdrantService,
    {
      provide: QdrantClient,
      useFactory: (configService: ConfigService) => {
        return new QdrantClient({
          url: configService.get('QDRANT_URL'),
          port: 6333,
          apiKey: configService.get('QDRANT_API_KEY'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [EmbeddingService, QdrantClient, QdrantService],
})
export class EmbeddingModule {}
