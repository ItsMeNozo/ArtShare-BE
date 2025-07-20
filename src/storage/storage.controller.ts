import { Body, Controller, Post } from '@nestjs/common';
import { GetPresignedUrlRequestDto } from './dto/request.dto';
import { GetPresignedUrlResponseDto } from './dto/response.dto';
import { StorageService } from './storage.service';

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
