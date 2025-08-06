import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { TryCatch } from 'src/common/try-catch.decorator';
import { AutoProjectStatus, Platform } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { CreateAutoProjectDto } from './dto/request/create-project.dto';
import { UpdateAutoProjectDto } from './dto/request/update-project.dto';
import { AutoProjectDetailsDto } from './dto/response/auto-project-details.dto';

@Injectable()
export class AutoProjectWriteService {
  private readonly logger: Logger;

  constructor(private readonly prisma: PrismaService) {
    this.logger = new Logger(AutoProjectWriteService.name);
  }

  @TryCatch()
  async create(
    createDto: CreateAutoProjectDto,
    userId: string,
  ): Promise<AutoProjectDetailsDto> {
    const { title, description, platformId } = createDto;

    const validatedPlatformRecord = await this.validatePlatform(
      platformId,
      userId,
    );

    const createdAutoProject = await this.prisma.autoProject.create({
      data: {
        title,
        description,
        userId: userId,
        platformId: validatedPlatformRecord.id,
        status: AutoProjectStatus.DRAFT,
      },
      include: {
        platform: true,
      },
    });

    return createdAutoProject;
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
  async activateProject(
    id: number,
    userId: string,
  ): Promise<AutoProjectDetailsDto> {
    const project = await this.prisma.autoProject.findFirst({
      where: { id, userId },
      include: { autoPosts: true },
    });

    if (!project) {
      throw new NotFoundException(`Auto project with ID ${id} not found.`);
    }

    if (
      project.status !== AutoProjectStatus.DRAFT &&
      project.status !== AutoProjectStatus.PAUSED
    ) {
      throw new BadRequestException(
        `Project cannot be activated from its current status: ${project.status}`,
      );
    }

    if (project.autoPosts.length === 0) {
      throw new BadRequestException('Cannot start a project with no posts.');
    }

    const now = new Date();
    for (const post of project.autoPosts) {
      if (!post.scheduledAt || new Date(post.scheduledAt) <= now) {
        throw new BadRequestException(
          `All posts must have a scheduled time in the future. Post ID ${post.id} has an invalid schedule.`,
        );
      }
    }

    const updatedProject = await this.prisma.autoProject.update({
      where: { id },
      data: { status: AutoProjectStatus.ACTIVE },
      include: { autoPosts: true, platform: true },
    });

    return plainToInstance(AutoProjectDetailsDto, updatedProject);
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

    if (['ACTIVE', 'COMPLETED'].includes(existingProject.status)) {
      throw new ForbiddenException(
        `Cannot edit a project with status '${existingProject.status}'.`,
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
  async updateStatus(
    id: number,
    status: AutoProjectStatus,
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
      data: { status },
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
