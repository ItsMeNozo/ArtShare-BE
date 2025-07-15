import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetPresignedUrlRequestDto } from './dto/request.dto';
import {
  FileUploadResponse,
  GetPresignedUrlResponseDto,
} from './dto/response.dto';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { IStorageProvider } from './storage.interface';

@Injectable()
export class StorageService {
  private storageProvider: IStorageProvider;

  constructor(
    private s3Provider: S3StorageProvider,
    private readonly configService: ConfigService,
  ) {
    // undo this code in case switching between minio and s3
    // const storageType = this.configService.get<string>('STORAGE_TYPE') || 's3';
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
