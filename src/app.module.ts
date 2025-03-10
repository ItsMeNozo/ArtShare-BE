import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { ExampleModule } from './example/example.module';
import { SemanticSearchModule } from './semantic-search/semantic-search.module';

@Module({
  imports: [ExampleModule, SemanticSearchModule],
  controllers: [AppController],
  providers: [AppService, PrismaService]
})
export class AppModule {}
