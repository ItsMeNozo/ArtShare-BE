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
import { ConfigModule } from '@nestjs/config';
import { CategoriesModule } from './categories/categories.module';
import { CollectionModule } from './collection/collection.module';
import { ReportModule } from './report/report.module';
import { StripeModule } from './stripe/stripe.module';
import { CommentModule } from './comment/comment.module';
import { ArtGenerationModule } from './art-generation/art-generation.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UsageModule } from './usage/usage.module';

import { StatisticsModule } from './statistics/statistics.module';
import { TrendingModule } from './trending/trending.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SafeSearchModule } from './safe-search/safe-search.module';

import { FirebaseModule } from './firebase/firebase.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationModule } from './notification/notification.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AutoProjectModule } from './auto-project/auto-project.module';
import { AutoPostModule } from './auto-post/auto-post.module';
import { PlatformModule } from './platform/platform.module';
import { CacheModule } from './infastructure/simple-cache.module';
import embeddingConfig from './config/embedding.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available globally
      load: [embeddingConfig],
      cache: true,
    }),
    EventEmitterModule.forRoot(),
    UserModule,
    AuthModule,
    PostsModule,
    LikesModule,
    SharesModule,
    StorageModule,
    EmbeddingModule,
    PrismaModule,
    BlogModule,
    CategoriesModule,
    CollectionModule,
    ReportModule,
    CommentModule,
    StripeModule,
    UsageModule,
    ScheduleModule.forRoot(),
    ArtGenerationModule,
    StatisticsModule,
    TrendingModule,
    SubscriptionModule,
    SafeSearchModule,
    FirebaseModule,
    AnalyticsModule,
    NotificationModule,
    AutoProjectModule,
    AutoPostModule,
    PlatformModule,
    NotificationModule,
    CacheModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
