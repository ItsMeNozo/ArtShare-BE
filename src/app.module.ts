import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { ExampleModule } from './example/example.module';
import { PostsModule } from './posts/posts.module';
import { LikesModule } from './likes/likes.module';
import { SharesModule } from './shares/shares.module';
import { StorageModule } from './storage/storage.module';
import { EmbeddingModule } from './embedding/embedding.module';

@Module({
  imports: [
    ExampleModule,
    PostsModule,
    LikesModule,
    SharesModule,
    StorageModule,
    EmbeddingModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
