import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { generatePaginatedResponse } from 'src/common/helpers/pagination.helper';
import { EncryptionService } from 'src/encryption/encryption.service';
import { AutoPost, AutoPostStatus, Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import {
  GetAutoPostsQueryDto,
  ScheduleAutoPostDto,
  UpdateAutoPostDto,
  UpdateAutoPostStatusDto,
} from './dto/auto-post.dto';

export interface PlatformConfig {
  encryptedFacebookAccessToken?: string;
  facebookPageId?: string;
}

@Injectable()
export class AutoPostService {
  private readonly logger = new Logger(AutoPostService.name);
  private readonly n8nExecutePostWebhookUrl?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly storageService: StorageService,
  ) {
    this.n8nExecutePostWebhookUrl = this.configService.get<string>(
      'N8N_EXECUTE_FACEBOOK_POST_WEBHOOK_URL',
    );
    if (!this.n8nExecutePostWebhookUrl) {
      this.logger.warn('N8N_EXECUTE_FACEBOOK_POST_WEBHOOK_URL not configured!');
    }
  }

  private async findAutoPostOrThrow(id: number): Promise<AutoPost> {
    const post = await this.prisma.autoPost.findUnique({
      where: { id },
    });
    if (!post) {
      throw new NotFoundException(`AutoPost with ID ${id} not found.`);
    }
    return post;
  }

  async createAutoPost(dto: ScheduleAutoPostDto): Promise<AutoPost> {
    this.logger.log(
      `Creating AutoPost for AutoProject ID ${dto.autoProjectId} at ${dto.scheduledAt}`,
    );
    try {
      const autoProject = await this.prisma.autoProject.findUnique({
        where: { id: dto.autoProjectId },
      });
      if (!autoProject) {
        throw new NotFoundException(
          `AutoProject with ID ${dto.autoProjectId} not found.`,
        );
      }

      return await this.prisma.autoPost.create({
        data: {
          autoProjectId: dto.autoProjectId,
          content: dto.content,
          scheduledAt: new Date(dto.scheduledAt),
          imageUrls: dto.imageUrls || [],
          status: AutoPostStatus.PENDING,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create AutoPost: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Could not create the AutoPost.');
    }
  }

  async getAutoPostById(id: number): Promise<AutoPost | null> {
    this.logger.log(`Fetching AutoPost with ID: ${id}`);
    return await this.prisma.autoPost.findUnique({
      where: { id },
    });
  }

  async getAllAutoPosts(
    query: GetAutoPostsQueryDto,
  ): Promise<PaginatedResponse<AutoPost>> {
    this.logger.log('Fetching all AutoPosts with query:', query);
    const {
      page = 1,
      limit = 10,
      status,
      autoProjectId,
      sortBy = 'scheduledAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.AutoPostWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (autoProjectId) {
      where.autoProjectId = autoProjectId;
    }

    const skip = (page - 1) * limit;

    const [posts, count] = await this.prisma.$transaction([
      this.prisma.autoPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.autoPost.count({ where }),
    ]);

    return generatePaginatedResponse(posts, count, {
      page,
      limit,
    });
  }

  async updateAutoPost(id: number, dto: UpdateAutoPostDto): Promise<AutoPost> {
    this.logger.log(`Updating AutoPost with ID: ${id}`);
    const existingPost = await this.findAutoPostOrThrow(id);

    if (
      existingPost.status !== AutoPostStatus.PENDING &&
      existingPost.status !== AutoPostStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot update post in status: ${existingPost.status}. Only PENDING or FAILED posts can be updated.`,
      );
    }

    const dataToUpdate: Prisma.AutoPostUpdateInput = {};
    if (dto.content !== undefined) dataToUpdate.content = dto.content;
    if (dto.scheduledAt !== undefined)
      dataToUpdate.scheduledAt = new Date(dto.scheduledAt);
    if (dto.imageUrls !== undefined) {
      dataToUpdate.imageUrls = dto.imageUrls;

      const existingImageUrls = existingPost.imageUrls || [];
      const urlsToDelete = existingImageUrls.filter(
        (url: string) => !dto.imageUrls!.includes(url),
      );
      if (urlsToDelete.length > 0) {
        this.storageService.deleteFiles(urlsToDelete);
      }
    }

    const hasSubstantiveChanges =
      dto.content || dto.scheduledAt || dto.imageUrls;

    if (
      existingPost.status === AutoPostStatus.FAILED &&
      hasSubstantiveChanges
    ) {
      dataToUpdate.status = AutoPostStatus.PENDING;
      dataToUpdate.errorMessage = null;
      dataToUpdate.n8nTriggeredAt = null;
      dataToUpdate.postedAt = null;
      dataToUpdate.n8nExecutionId = null;
      dataToUpdate.platformPostId = null;
    }

    return await this.prisma.autoPost.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async deleteAutoPost(id: number): Promise<void> {
    this.logger.log(`Deleting AutoPost with ID: ${id}`);
    const post = await this.findAutoPostOrThrow(id);

    if (post.status === AutoPostStatus.POSTED) {
      throw new BadRequestException(
        `Cannot delete a post that is ${post.status}. Consider cancelling it instead if it's not yet posted or has failed.`,
      );
    }

    await this.prisma.autoPost.delete({
      where: { id },
    });
    this.logger.log(`Successfully deleted AutoPost ID: ${id}`);
  }

  async updateAutoPostStatus(dto: UpdateAutoPostStatusDto): Promise<AutoPost> {
    this.logger.log(
      `Updating status for AutoPost ID ${dto.autoPostId} to ${dto.status}`,
    );

    await this.findAutoPostOrThrow(dto.autoPostId);

    const dataToUpdate: Prisma.AutoPostUpdateInput = {
      status: dto.status,
      errorMessage: dto.errorMessage,
      n8nExecutionId: dto.n8nExecutionId,
      platformPostId: dto.platformPostId,
    };

    if (dto.status === AutoPostStatus.POSTED) {
      dataToUpdate.postedAt = new Date();
      dataToUpdate.errorMessage = null;
    } else if (dto.status !== AutoPostStatus.FAILED) {
      dataToUpdate.errorMessage = null;
    }

    return await this.prisma.autoPost.update({
      where: { id: dto.autoPostId },
      data: dataToUpdate,
    });
  }

  async cancelAutoPost(autoPostId: number): Promise<AutoPost> {
    this.logger.log(`Cancelling AutoPost ID: ${autoPostId}`);
    const post = await this.findAutoPostOrThrow(autoPostId);

    if (post.status === AutoPostStatus.POSTED) {
      throw new BadRequestException(
        'Cannot cancel a post that has already been posted.',
      );
    }
    if (post.status === AutoPostStatus.CANCELLED) {
      this.logger.warn(`AutoPost ID ${autoPostId} is already cancelled.`);
      return post;
    }

    if (
      post.status !== AutoPostStatus.PENDING &&
      post.status !== AutoPostStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot cancel post in status: ${post.status}. Only PENDING or FAILED posts can be cancelled.`,
      );
    }

    return await this.prisma.autoPost.update({
      where: { id: autoPostId },
      data: {
        status: AutoPostStatus.CANCELLED,
        errorMessage: null,
      },
    });
  }
}
