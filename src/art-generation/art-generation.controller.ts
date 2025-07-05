import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ArtGenerationService } from './art-generation.service';
import { ImageGenerationDto } from './dto/request/image-generation.dto';
import { GetPromptHistoryQueryDto } from './dto/request/get-prompt-history-query.dto';
import { ImageGenerationResponseDto } from './dto/response/image-generation.dto';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { PromptService } from './prompt.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UpdatePromptHistoryDto } from './dto/request/update-prompt-history.dto';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';

@Controller('art-generation')
@UseGuards(JwtAuthGuard)
export class ArtGenerationController {
  constructor(
    private readonly artGenerationService: ArtGenerationService,
    private readonly promptService: PromptService,
  ) { }
  
  @Post('text-to-image')
  async generateImage(
    @Body() imageGenerationDto: ImageGenerationDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<ImageGenerationResponseDto> {
    return await this.artGenerationService.generateImages(imageGenerationDto, user.id);
  }

  @Get('/prompt-history')
  async getPromptHistory(
    @Query() query: GetPromptHistoryQueryDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<PaginatedResponse<ImageGenerationResponseDto>> {
    return await this.promptService.getPromptHistory(user.id, query);
  }

  @Patch('/prompt-history/:promptId')
  async updatePromptHistory(
    @Param('promptId', ParseIntPipe) promptId: number,
    @Body() updatePromptHistoryDto: UpdatePromptHistoryDto,
  ): Promise<ImageGenerationResponseDto> {
    return await this.promptService.updatePromptHistory(promptId, updatePromptHistoryDto);
  }
}
