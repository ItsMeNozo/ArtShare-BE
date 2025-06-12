import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateAutoProjectDto } from './dto/request/create-project.dto';
import { AutoPostGenerateService } from 'src/auto-post/auto-post-generate.service';
import { Platform, PrismaClient } from '@prisma/client';
import { TryCatch } from 'src/common/try-catch.decorator';
import { plainToInstance } from 'class-transformer';
import { AutoProjectDetailsDto } from './dto/response/auto-project-details.dto';
import { UsageService } from 'src/usage/usage.service';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { UpdateAutoProjectDto } from './dto/request/update-project.dto';

@Injectable()
export class AutoProjectWriteService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly autoPostGenerateService: AutoPostGenerateService,
    private readonly usageService: UsageService,
  ) {}

  private readonly textCost = 2;
  private readonly imageCost = 5;

  @TryCatch()
  async create(
    createDto: CreateAutoProjectDto,
    userId: string,
  ): Promise<AutoProjectDetailsDto> {
    const { title, description, platform_id, auto_post_meta_list } = createDto;

    const validatedPlatformRecord = await this.validatePlatform(
      platform_id,
      userId,
    );

    await this.usageService.handleCreditUsage(
      userId,
      FeatureKey.AI_CREDITS,
      this.textCost + this.imageCost * auto_post_meta_list.length,
    );

    const generatedAutoPosts =
      await this.autoPostGenerateService.generateAutoPosts(
        auto_post_meta_list,
        { project_title: title, project_description: description },
        userId,
      );

    const createdAutoProject = await this.prisma.autoProject.create({
      data: {
        title,
        description,
        user_id: userId,
        platform_id: validatedPlatformRecord.id,
        autoPosts: {
          create: generatedAutoPosts.map((post) => ({
            content: post.content,
            image_urls: post.imageUrls,
            scheduled_at: post.scheduledAt,
          })),
        },
      },
      include: {
        autoPosts: true,
        platform: true,
      },
    });

    const resultDto = plainToInstance(
      AutoProjectDetailsDto,
      createdAutoProject,
    );

    if (createdAutoProject.platform) {
      resultDto.platform = {
        id: createdAutoProject.platform.id,
        name: createdAutoProject.platform.name.toString(),
        external_page_id: createdAutoProject.platform.external_page_id,
        config: createdAutoProject.platform.config,
      };
    }

    return resultDto;
  }

  private async validatePlatform(
    platformId: number,
    userId: string,
  ): Promise<Platform> {
    const platformRecord = await this.prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platformRecord) {
      throw new NotFoundException(
        `Platform connection with ID ${platformId} not found.`,
      );
    }

    if (platformRecord.user_id !== userId) {
      this.logger.warn(
        `User ${userId} attempted to use Platform ID ${platformId} which belongs to user ${platformRecord.user_id}.`,
      );
      throw new ForbiddenException(
        `You do not have permission to use platform connection with ID ${platformId}.`,
      );
    }

    return platformRecord;
  }

  @TryCatch()
  async update(
    id: number,
    updateDto: UpdateAutoProjectDto,
    userId: string,
  ): Promise<AutoProjectDetailsDto> {
    const { title, description } = updateDto;

    const existingProject = await this.prisma.autoProject.findFirst({
      where: { id, user_id: userId },
    });

    if (!existingProject) {
      throw new BadRequestException(
        `Auto project with ID ${id} not found or does not belong to user ${userId}.`,
      );
    }

    const updatedProject = await this.prisma.autoProject.update({
      where: { id },
      data: {
        title,
        description,
      },
      include: { autoPosts: true },
    });

    return plainToInstance(AutoProjectDetailsDto, updatedProject);
  }

  @TryCatch()
  async remove(id: number, userId: string): Promise<void> {
    const existingProject = await this.prisma.autoProject.findFirst({
      where: { id, user_id: userId },
    });

    if (!existingProject) {
      throw new BadRequestException(
        `Auto project with ID ${id} not found or does not belong to user ${userId}.`,
      );
    }

    await this.prisma.autoProject.delete({
      where: { id },
    });
  }
}
