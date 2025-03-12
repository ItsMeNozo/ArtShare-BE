import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { ExampleModule } from './example/example.module';
import { BlogModule } from './blog/blog.module';

@Module({
  imports: [ExampleModule, BlogModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
