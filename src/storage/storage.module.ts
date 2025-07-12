import { Module } from '@nestjs/common';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  providers: [StorageService, S3StorageProvider],
  controllers: [StorageController],
  exports: [StorageService],
})
export class StorageModule {}
