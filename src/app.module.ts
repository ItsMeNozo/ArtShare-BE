import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PostsModule } from './posts/posts.module';
import { LikesModule } from './likes/likes.module';
import { SharesModule } from './shares/shares.module';
import { StorageModule } from './storage/storage.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { BlogModule } from './blog/blog.module';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    PostsModule,
    LikesModule,
    SharesModule,
    StorageModule,
    EmbeddingModule,
    PrismaModule,
    BlogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
