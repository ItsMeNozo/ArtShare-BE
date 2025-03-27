import { Controller, Post, Body } from '@nestjs/common';
import { StorageService } from './storage.service';
import { GetPresignedUrlRequestDto } from './dto/request.dto';
import { GetPresignedUrlResponseDto } from './dto/response.dto';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presigned-url')
  async getPresignedUrl(
    @Body() request: GetPresignedUrlRequestDto,
  ): Promise<GetPresignedUrlResponseDto> {
    return this.storageService.generatePresignedUrl(request);
  }
}
