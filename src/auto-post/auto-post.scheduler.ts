import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { EncryptionService } from 'src/encryption/encryption.service';
import {
  AutoPostStatus,
  AutoProjectStatus,
  Prisma,
  SharePlatform,
} from 'src/generated';
import { PlatformPageConfig } from 'src/platform/dtos/platform-config.interface';
import { PrismaService } from 'src/prisma.service';

export interface PlatformConfig {
  encryptedFacebookAccessToken?: string;
  facebookPageId?: string;
}

@Injectable()
export class AutoPostScheduler {
  private readonly logger = new Logger(AutoPostScheduler.name);
  private readonly n8nExecutePostWebhookUrl?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.n8nExecutePostWebhookUrl = this.configService.get<string>(
      'N8N_EXECUTE_FACEBOOK_POST_WEBHOOK_URL',
    );
    if (!this.n8nExecutePostWebhookUrl) {
      this.logger.warn('N8N_EXECUTE_FACEBOOK_POST_WEBHOOK_URL not configured!');
    }
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
        scheduledAt: {
          lte: new Date(),
        },
        autoProject: {
          status: AutoProjectStatus.ACTIVE,
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
        scheduledAt: 'asc',
      },
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

      if (post.autoProject.status !== AutoProjectStatus.ACTIVE) {
        this.logger.log(
          `Skipping post ID ${post.id} because its project (ID: ${post.autoProject.id}) is now PAUSED.`,
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

      const encryptedPageAccessToken = pageSpecificConfig.encryptedAccessToken;
      const facebookPageId = platformRecord.externalPageId;

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
          imageUrls: post.imageUrls,
          autoProjectId: post.autoProject.id,
          userId: post.autoProject.userId,
        };

        await this.prisma.autoPost.update({
          where: { id: post.id },
          data: {
            n8nTriggeredAt: new Date(),
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

  private async failPost(
    postId: number,
    errorMessage: string,
    n8nTriggeredAt: Date | null = null,
  ) {
    const dataToUpdate: Prisma.AutoPostUpdateInput = {
      status: AutoPostStatus.FAILED,
      errorMessage: errorMessage.substring(0, 1000),
    };
    if (n8nTriggeredAt === null) {
      dataToUpdate.n8nTriggeredAt = null;
    }
    await this.prisma.autoPost.update({
      where: { id: postId },
      data: dataToUpdate,
    });
  }
}
