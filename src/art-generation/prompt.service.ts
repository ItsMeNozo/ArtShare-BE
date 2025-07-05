import { Injectable, NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { PrismaService } from "src/prisma.service";
import { UpdatePromptHistoryDto } from "./dto/request/update-prompt-history.dto";
import { TryCatch } from "src/common/try-catch.decorator";
import { ImageGenerationResponseDto } from "./dto/response/image-generation.dto";

@Injectable()
export class PromptService {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  @TryCatch()
  async getPromptHistory(userId: string): Promise<ImageGenerationResponseDto[]> {
    const promptHistory = await this.prismaService.artGeneration.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return plainToInstance(ImageGenerationResponseDto, promptHistory);
  }

  @TryCatch()
  async updatePromptHistory(
    promptId: number,
    updatePromptHistoryDto: UpdatePromptHistoryDto,
  ): Promise<ImageGenerationResponseDto> {
    const existingPromptHistory = await this.prismaService.artGeneration.findUnique({
      where: {
        id: promptId,
      },
    });
    if (!existingPromptHistory) {
      throw new NotFoundException(`Prompt history with id = ${promptId} not found`);
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