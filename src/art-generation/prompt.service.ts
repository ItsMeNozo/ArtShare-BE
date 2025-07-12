import { Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { TryCatch } from 'src/common/try-catch.decorator';
import { PrismaService } from 'src/prisma.service';
import { GetPromptHistoryQueryDto } from './dto/request/get-prompt-history-query.dto';
import { UpdatePromptHistoryDto } from './dto/request/update-prompt-history.dto';
import { ImageGenerationResponseDto } from './dto/response/image-generation.dto';

@Injectable()
export class PromptService {
  constructor(private readonly prismaService: PrismaService) {}

  @TryCatch()
  async getPromptHistory(
    userId: string,
    query: GetPromptHistoryQueryDto,
  ): Promise<PaginatedResponse<ImageGenerationResponseDto>> {
    const { limit = 10, page = 1 } = query;
    const skip = (page - 1) * limit;

    const [promptHistory, totalCount] = await Promise.all([
      this.prismaService.artGeneration.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: skip,
      }),
      this.prismaService.artGeneration.count({
        where: {
          userId,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;

    return {
      data: plainToInstance(ImageGenerationResponseDto, promptHistory),
      total: totalCount,
      page,
      limit,
      totalPages,
      hasNextPage,
    };
  }

  @TryCatch()
  async updatePromptHistory(
    promptId: number,
    updatePromptHistoryDto: UpdatePromptHistoryDto,
  ): Promise<ImageGenerationResponseDto> {
    const existingPromptHistory =
      await this.prismaService.artGeneration.findUnique({
        where: {
          id: promptId,
        },
      });
    if (!existingPromptHistory) {
      throw new NotFoundException(
        `Prompt history with id = ${promptId} not found`,
      );
    }
    const updatedPromptHistory = await this.prismaService.artGeneration.update({
      where: {
        id: promptId,
      },
      data: {
        imageUrls: updatePromptHistoryDto.imageUrls,
      },
    });

    return plainToInstance(ImageGenerationResponseDto, updatedPromptHistory);
  }
}
