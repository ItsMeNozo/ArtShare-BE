import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Module({
  providers: [StorageService, S3StorageProvider],
  controllers: [StorageController],
  exports: [StorageService],
})
export class StorageModule {}
