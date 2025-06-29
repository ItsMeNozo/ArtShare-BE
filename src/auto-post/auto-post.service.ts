import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Cron, CronExpression } from '@nestjs/schedule';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { generatePaginatedResponse } from 'src/common/helpers/pagination.helper';
import { EncryptionService } from 'src/encryption/encryption.service';
import { AutoPost, AutoPostStatus, Prisma, SharePlatform } from 'src/generated';
import { PlatformPageConfig } from 'src/platform/dtos/platform-config.interface.js';
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
          auto_project_id: dto.autoProjectId,
          content: dto.content,
          scheduled_at: new Date(dto.scheduledAt),
          image_urls: dto.imageUrls || [],
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
      sortBy = 'scheduled_at',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.AutoPostWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (autoProjectId) {
      where.auto_project_id = autoProjectId;
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
      dataToUpdate.scheduled_at = new Date(dto.scheduledAt);
    if (dto.imageUrls !== undefined) {
      dataToUpdate.image_urls = dto.imageUrls;

      const existingImageUrls = existingPost.image_urls || [];
      const urlsToDelete = existingImageUrls.filter(
        (url) => !dto.imageUrls!.includes(url),
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
      dataToUpdate.error_message = null;
      dataToUpdate.n8n_triggered_at = null;
      dataToUpdate.posted_at = null;
      dataToUpdate.n8n_execution_id = null;
      dataToUpdate.platform_post_id = null;
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

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledPostsTrigger() {
    if (!this.n8nExecutePostWebhookUrl) {
      this.logger.warn(
        'N8N_EXECUTE_POST_WEBHOOK_URL is not set in environment variables. Skipping post trigger.',
      );
      return;
    }

    const duePosts = await this.prisma.autoPost.findMany({
      where: {
        status: AutoPostStatus.PENDING,
        scheduled_at: {
          lte: new Date(),
        },
      },
      include: {
        autoProject: {
          include: {
            platform: true,
          },
        },
      },
      orderBy: {
        scheduled_at: 'asc',
      },
      take: 10,
    });

    if (duePosts.length === 0) {
      return;
    }
    this.logger.log(`Found ${duePosts.length} due posts to trigger.`);

    for (const post of duePosts) {
      if (!post.autoProject) {
        this.logger.error(
          `AutoProject data missing for AutoPost ID ${post.id}. Marking as FAILED.`,
        );
        await this.failPost(
          post.id,
          'Configuration error: AutoProject details missing.',
        );
        continue;
      }

      const platformRecord = post.autoProject.platform;
      if (!platformRecord) {
        this.logger.error(
          `Platform record (page connection) missing for AutoPost ID ${post.id} (AutoProject ID: ${post.autoProject.id}). Marking as FAILED.`,
        );
        await this.failPost(
          post.id,
          'Configuration error: Linked Platform (page connection) details missing.',
        );
        continue;
      }

      if (platformRecord.name !== SharePlatform.FACEBOOK) {
        this.logger.error(
          `Platform linked to AutoPost ID ${post.id} is not FACEBOOK (${platformRecord.name}). Skipping.`,
        );

        await this.failPost(
          post.id,
          `Configuration error: Platform type is ${platformRecord.name}, expected FACEBOOK.`,
        );
        continue;
      }

      if (
        !platformRecord.config ||
        typeof platformRecord.config !== 'object' ||
        Array.isArray(platformRecord.config)
      ) {
        this.logger.error(
          `Platform config is invalid or missing for Platform ID ${platformRecord.id} (AutoPost ID ${post.id}). Marking as FAILED.`,
        );
        await this.failPost(
          post.id,
          'Configuration error: Platform configuration is invalid or missing.',
        );
        continue;
      }

      const pageSpecificConfig =
        platformRecord.config as unknown as PlatformPageConfig;

      const encryptedPageAccessToken =
        pageSpecificConfig.encrypted_access_token;
      const facebookPageId = platformRecord.external_page_id;

      if (!encryptedPageAccessToken) {
        this.logger.error(
          `Encrypted access token missing in Platform config for Platform ID ${platformRecord.id} (AutoPost ID ${post.id}). Marking as FAILED.`,
        );
        await this.failPost(
          post.id,
          'Configuration error: Platform access token missing in config.',
        );
        continue;
      }

      if (!facebookPageId) {
        this.logger.error(
          `External Page ID missing on Platform record ID ${platformRecord.id} (AutoPost ID ${post.id}). Marking as FAILED.`,
        );
        await this.failPost(
          post.id,
          'Configuration error: Facebook Page ID missing on Platform record.',
        );
        continue;
      }

      let decryptedAccessToken: string;
      try {
        decryptedAccessToken = this.encryptionService.decrypt(
          encryptedPageAccessToken,
        );
      } catch (decryptionError) {
        this.logger.error(
          `Token decryption failed for AutoPost ID ${post.id} (Platform ID ${platformRecord.id}). Marking as FAILED.`,
          (decryptionError as Error).message,
        );
        await this.failPost(
          post.id,
          'Token decryption failed. The page connection may need to be refreshed.',
        );
        continue;
      }

      try {
        const payloadToN8n = {
          autoPostId: post.id,
          content: post.content,
          facebookPageId: facebookPageId,
          facebookAccessToken: decryptedAccessToken,
          imageUrls: post.image_urls,

          autoProjectId: post.autoProject.id,
          userId: post.autoProject.user_id,
        };

        await this.prisma.autoPost.update({
          where: { id: post.id },
          data: {
            n8n_triggered_at: new Date(),
          },
        });

        this.logger.log(
          `Triggering n8n for AutoPost ID: ${post.id} for Facebook Page ID: ${facebookPageId}`,
        );

        await firstValueFrom(
          this.httpService.post(this.n8nExecutePostWebhookUrl, payloadToN8n),
        );

        this.logger.log(
          `Successfully triggered n8n for AutoPost ID: ${post.id}`,
        );
      } catch (error) {
        const err = error as AxiosError;
        this.logger.error(
          `Failed to trigger n8n for AutoPost ID: ${post.id} (Page ID: ${facebookPageId})`,
          err.response?.data || err.message,
        );

        await this.failPost(
          post.id,
          `N8N Trigger Failed: ${err.message?.substring(0, 200) || 'Unknown n8n trigger error'}`,
          new Date(),
        );
      }
    }
  }

  async updateAutoPostStatus(dto: UpdateAutoPostStatusDto): Promise<AutoPost> {
    this.logger.log(
      `Updating status for AutoPost ID ${dto.autoPostId} to ${dto.status}`,
    );

    await this.findAutoPostOrThrow(dto.autoPostId);

    const dataToUpdate: Prisma.AutoPostUpdateInput = {
      status: dto.status,
      error_message: dto.errorMessage,
      n8n_execution_id: dto.n8nExecutionId,
      platform_post_id: dto.platformPostId,
    };

    if (dto.status === AutoPostStatus.POSTED) {
      dataToUpdate.posted_at = new Date();
      dataToUpdate.error_message = null;
    } else if (dto.status !== AutoPostStatus.FAILED) {
      dataToUpdate.error_message = null;
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
        error_message: null,
      },
    });
  }
  private async failPost(
    postId: number,
    errorMessage: string,
    n8nTriggeredAt: Date | null = null,
  ) {
    const dataToUpdate: any = {
      status: AutoPostStatus.FAILED,
      error_message: errorMessage.substring(0, 1000),
    };
    if (n8nTriggeredAt === null) {
      dataToUpdate.n8n_triggered_at = null;
    }
    await this.prisma.autoPost.update({
      where: { id: postId },
      data: dataToUpdate,
    });
  }
}
