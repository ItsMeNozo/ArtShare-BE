import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';

@Module({
  imports: [AuthModule],
  controllers: [CollectionController],
  providers: [CollectionService],
})
export class CollectionModule {}
