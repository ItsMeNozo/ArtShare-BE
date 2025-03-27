import { Injectable } from '@nestjs/common';
import { IStorageProvider } from './storage.interface';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { GetPresignedUrlRequestDto } from './dto/request.dto';
import {
  FileUploadResponse,
  GetPresignedUrlResponseDto,
} from './dto/response.dto';

@Injectable()
export class StorageService {
  private storageProvider: IStorageProvider;

  constructor(private s3Provider: S3StorageProvider) {
    // undo this code in case switching between minio and s3
    // const storageType = process.env.STORAGE_TYPE || 's3';
    // this.storageProvider = storageType === 'minio' ? this.minioProvider : this.s3Provider;
    this.storageProvider = this.s3Provider;
  }

  async generatePresignedUrl(
    request: GetPresignedUrlRequestDto,
  ): Promise<GetPresignedUrlResponseDto> {
    return this.storageProvider.generatePresignedUrl(request);
  }

  async deleteFiles(fileUrls: string[]) {
    return this.storageProvider.deleteFiles(fileUrls);
  }

  async uploadFiles(
    files: Express.Multer.File[],
    directory: string,
  ): Promise<FileUploadResponse[]> {
    return this.storageProvider.uploadFiles(files, directory);
  }

  async getBucketUrl() {
    return this.storageProvider.getBucketUrl();
  }
}
