import { GetPresignedUrlRequestDto } from './dto/request.dto';
import { GetPresignedUrlResponseDto } from './dto/response.dto';

export interface IStorageProvider {
  generatePresignedUrl(
    request: GetPresignedUrlRequestDto,
  ): Promise<GetPresignedUrlResponseDto>;

  deleteFile(url: string): Promise<void>;
}
