import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CorsService } from './common/cors.service';
import { ArtGenerationModule } from './art-generation/art-generation.module';
import { AuthModule } from './auth/auth.module';
import { BlogModule } from './blog/blog.module';
import { CategoriesModule } from './categories/categories.module';
import { CollectionModule } from './collection/collection.module';
import { CommentModule } from './comment/comment.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { LikesModule } from './likes/likes.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma.module';
import { ReportModule } from './report/report.module';
import { SharesModule } from './shares/shares.module';
import { StorageModule } from './storage/storage.module';
import { StripeModule } from './stripe/stripe.module';
import { UsageModule } from './usage/usage.module';
import { UserModule } from './user/user.module';

import { SafeSearchModule } from './safe-search/safe-search.module';
import { StatisticsModule } from './statistics/statistics.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { TrendingModule } from './trending/trending.module';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { AnalyticsModule } from './analytics/analytics.module';
import { FirebaseModule } from './firebase/firebase.module';
import { NotificationModule } from './notification/notification.module';

import { AutoPostModule } from './auto-post/auto-post.module';
import { AutoProjectModule } from './auto-project/auto-project.module';
import embeddingConfig from './config/embedding.config';
import { CacheModule } from './infastructure/simple-cache.module';
import { PlatformModule } from './platform/platform.module';

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
  providers: [AppService, CorsService],
})
export class AppModule {}
