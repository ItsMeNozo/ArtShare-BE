import { GetPresignedUrlRequestDto } from './dto/request.dto';
import {
  FileUploadResponse,
  GetPresignedUrlResponseDto,
} from './dto/response.dto';

export interface IStorageProvider {
  generatePresignedUrl(
    request: GetPresignedUrlRequestDto,
  ): Promise<GetPresignedUrlResponseDto>;

  deleteFiles(urls: string[]): Promise<void>;

  uploadFiles(
    files: Express.Multer.File[],
    directory: string,
  ): Promise<FileUploadResponse[]>;

  getBucketUrl(): string;
}
