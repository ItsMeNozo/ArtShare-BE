import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AutoPostGenerateService } from 'src/auto-post/auto-post-generate.service';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { TryCatch } from 'src/common/try-catch.decorator';
import { Platform } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { UsageService } from 'src/usage/usage.service';
import { CreateAutoProjectDto } from './dto/request/create-project.dto';
import { UpdateAutoProjectDto } from './dto/request/update-project.dto';
import { AutoProjectDetailsDto } from './dto/response/auto-project-details.dto';
import { mapToAutoProjectDetailsDto } from './mapper/index.mapper';

@Injectable()
export class AutoProjectWriteService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoPostGenerateService: AutoPostGenerateService,
    private readonly usageService: UsageService,
  ) {
    this.logger = new Logger(AutoProjectWriteService.name);
  }

  private readonly textCost = 2;
  private readonly imageCost = 5;

  @TryCatch()
  async create(
    createDto: CreateAutoProjectDto,
    userId: string,
  ): Promise<AutoProjectDetailsDto> {
    const { title, description, platformId, autoPostMetaList = [] } = createDto;

    const validatedPlatformRecord = await this.validatePlatform(
      platformId,
      userId,
    );

    const safeAutoPostMetaList = autoPostMetaList ?? [];

    await this.usageService.handleCreditUsage(
      userId,
      FeatureKey.AI_CREDITS,
      this.textCost + this.imageCost * safeAutoPostMetaList.length,
    );

    const generatedAutoPosts =
      await this.autoPostGenerateService.generateAutoPosts(
        safeAutoPostMetaList,
        { projectTitle: title, projectDescription: description },
        userId,
      );

    const createdAutoProject = await this.prisma.autoProject.create({
      data: {
        title,
        description,
        userId: userId,
        platformId: validatedPlatformRecord.id,
        autoPosts: {
          create: generatedAutoPosts.map((post) => ({
            content: post.content,
            imageUrls: post.imageUrls,
            scheduledAt: post.scheduledAt,
          })),
        },
      },
      include: {
        platform: true,
      },
    });

    return mapToAutoProjectDetailsDto(createdAutoProject);
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

    if (platformRecord.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to use Platform ID ${platformId} which belongs to user ${platformRecord.userId}.`,
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
    const existingProject = await this.prisma.autoProject.findFirst({
      where: { id, userId: userId },
    });

    if (!existingProject) {
      throw new BadRequestException(
        `Auto project with ID ${id} not found or does not belong to user ${userId}.`,
      );
    }

    const updatedProject = await this.prisma.autoProject.update({
      where: { id },
      data: updateDto,
      include: { autoPosts: true, platform: true },
    });

    return plainToInstance(AutoProjectDetailsDto, updatedProject);
  }

  @TryCatch()
  async remove(id: number, userId: string): Promise<void> {
    const existingProject = await this.prisma.autoProject.findFirst({
      where: { id, userId: userId },
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
