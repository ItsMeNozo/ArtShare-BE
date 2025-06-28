import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EncryptionService } from 'src/encryption/encryption.service';
import { Platform, PlatformStatus, Prisma, SharePlatform } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { CreatePlatformDto } from './dtos/create-platform.dto';
import { PlatformPageConfig } from './dtos/platform-config.interface';
import { PublicPlatformOutputDto } from './dtos/public-platform-output.dto';
import { SyncPlatformInputDto } from './dtos/sync-platform-input.dto';
import { UpdatePlatformConfigDto } from './dtos/update-platform-config.dto';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Creates a new platform connection.
   * Encrypts the access_token within the config.
   */
  async createPlatform(data: CreatePlatformDto): Promise<Platform> {
    const { userId, name, externalPageId, config: rawConfig } = data;

    const { page_name, access_token, category, ...otherConfigFields } =
      rawConfig;

    const platformConfig: PlatformPageConfig = {
      ...otherConfigFields,
      page_name: page_name,
      encrypted_access_token: this.encryptionService.encrypt(access_token),
      category: category || '',
    };

    delete (platformConfig as any).access_token;

    try {
      return await this.prisma.platform.create({
        data: {
          user_id: userId,
          name,
          external_page_id: externalPageId,
          config: platformConfig as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as any).code === 'P2002'
      ) {
        this.logger.warn(
          `Platform already exists for user ${userId}, type ${name}, external ID ${externalPageId}.`,
        );
        throw new NotFoundException(
          `Platform connection for user ${userId}, type ${name}, external ID ${externalPageId} already exists.`,
        );
      }
      this.logger.error(
        `Error creating platform for user ${userId}: ${(error as any).message}`,
        (error as any).stack,
      );
      throw new InternalServerErrorException(
        'Could not create platform connection.',
      );
    }
  }

  /**
   * Retrieves a platform by its internal database ID.
   */
  async getPlatformById(id: number): Promise<Platform | null> {
    const platform = await this.prisma.platform.findUnique({ where: { id } });
    if (!platform) {
      this.logger.warn(`Platform with ID ${id} not found.`);
    }
    return platform;
  }

  /**
   * Retrieves a platform by user_id, platform name (enum), and external_page_id.
   */
  async getPlatformByExternalDetails(
    userId: string,
    platformName: SharePlatform,
    externalPageId: string,
  ): Promise<Platform | null> {
    const platform = await this.prisma.platform.findUnique({
      where: {
        user_id_name_external_page_id: {
          user_id: userId,
          name: platformName,
          external_page_id: externalPageId,
        },
      },
    });
    if (!platform) {
      this.logger.debug(
        `Platform not found for user ${userId}, type ${platformName}, external ID ${externalPageId}.`,
      );
    }
    return platform;
  }

  /**
   * Finds all platforms associated with a given user ID.
   */
  async findPlatformsByUserId(userId: string): Promise<Platform[]> {
    return this.prisma.platform.findMany({
      where: { user_id: userId },
      include: {
        autoProjects: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Finds all platforms for a given user ID and specific platform name (e.g., all FACEBOOK platforms).
   */
  async findPlatformsByUserIdAndName(
    userId: string,
    platformName: SharePlatform,
  ): Promise<Platform[]> {
    return this.prisma.platform.findMany({
      where: {
        user_id: userId,
        name: platformName,
      },
      include: {
        autoProjects: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Updates the configuration of an existing platform.
   * If a new access_token is provided in the config, it will be encrypted.
   */
  async updatePlatformConfig(
    platformId: number,
    dto: UpdatePlatformConfigDto,
  ): Promise<Platform> {
    const existingPlatform = await this.getPlatformById(platformId);
    if (!existingPlatform) {
      throw new NotFoundException(`Platform with ID ${platformId} not found.`);
    }

    const currentConfig =
      (existingPlatform.config as unknown as PlatformPageConfig) || {};

    const { config: newConfigDataFromDto } = dto;

    const {
      page_name: newPageName,
      access_token: newAccessToken,
      category: newCategory,
      ...otherNewConfigFields
    } = newConfigDataFromDto;

    const updatedConfig: PlatformPageConfig = {
      ...currentConfig,
      ...otherNewConfigFields,
    };

    if (newPageName !== undefined) {
      updatedConfig.page_name = newPageName;
    }
    if (newCategory !== undefined) {
      updatedConfig.category = newCategory;
    }

    if (newAccessToken) {
      updatedConfig.encrypted_access_token =
        this.encryptionService.encrypt(newAccessToken);
    } else if (
      !updatedConfig.encrypted_access_token &&
      currentConfig.encrypted_access_token
    ) {
      updatedConfig.encrypted_access_token = newAccessToken
        ? this.encryptionService.encrypt(newAccessToken)
        : currentConfig.encrypted_access_token;
    }

    try {
      return await this.prisma.platform.update({
        where: { id: platformId },
        data: {
          config: updatedConfig as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error updating platform config for ID ${platformId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Could not update platform configuration.',
      );
    }
  }

  /**
   * Deletes a platform connection by its internal database ID.
   */
  async deletePlatform(platformId: number): Promise<Platform> {
    try {
      const platform = await this.prisma.platform.delete({
        where: { id: platformId },
      });
      this.logger.log(`Platform with ID ${platformId} deleted successfully.`);
      return platform;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as any).code === 'P2025'
      ) {
        this.logger.warn(
          `Attempted to delete non-existent platform with ID ${platformId}.`,
        );
        throw new NotFoundException(
          `Platform with ID ${platformId} not found for deletion.`,
        );
      }
      this.logger.error(
        `Error deleting platform with ID ${platformId}: ${(error as any).message}`,
        (error as any).stack,
      );
      throw new InternalServerErrorException(
        'Could not delete platform connection.',
      );
    }
  }

  /**
   * Synchronizes platform connections for a user based on data from an external API (e.g., Facebook pages).
   * Creates new connections, updates existing ones, and removes connections no longer authorized.
   */
  async synchronizePlatforms(
    input: SyncPlatformInputDto,
  ): Promise<PublicPlatformOutputDto[]> {
    const { userId, platformName, pagesFromApi, facebookAccountId } = input;

    try {
      const synchronizedPlatforms = await this.prisma.$transaction(
        async (tx) => {
          const authorizedApiPageIds = new Set(pagesFromApi.map((p) => p.id));
          const existingUserPlatforms = await tx.platform.findMany({
            where: {
              user_id: userId,
              name: platformName,
            },
          });

          const upsertPromises = pagesFromApi.map((pageFromApi) => {
            const {
              id: apiExternalId,
              name: apiPageName,
              access_token: apiAccessToken,
              category: apiCategory,
              token_expires_at,
              picture_url: apiPictureUrl,
              ...remainingApiFields
            } = pageFromApi;

            const pageConfigForDb: PlatformPageConfig = {
              ...remainingApiFields,
              page_name: apiPageName,
              encrypted_access_token:
                this.encryptionService.encrypt(apiAccessToken),
              category: apiCategory || '',
            };

            return tx.platform.upsert({
              where: {
                user_id_name_external_page_id: {
                  user_id: userId,
                  name: platformName,
                  external_page_id: apiExternalId,
                },
              },
              create: {
                user_id: userId,
                name: platformName,
                external_page_id: apiExternalId,
                config: pageConfigForDb as unknown as Prisma.InputJsonValue,
                status: PlatformStatus.ACTIVE,
                token_expires_at: token_expires_at,
                picture_url: apiPictureUrl || null,
                facebook_account_id: facebookAccountId,
              },
              update: {
                config: pageConfigForDb as unknown as Prisma.InputJsonValue,
                updated_at: new Date(),
                status: PlatformStatus.ACTIVE,
                token_expires_at: token_expires_at,
                picture_url: apiPictureUrl || null,
                facebook_account_id: facebookAccountId,
              },
            });
          });

          const upsertedPlatforms = await Promise.all(upsertPromises);

          const platformsToDelete = existingUserPlatforms.filter(
            (dbPlatform) =>
              !authorizedApiPageIds.has(dbPlatform.external_page_id),
          );

          if (platformsToDelete.length > 0) {
            const idsToDelete = platformsToDelete.map((p) => p.id);
            this.logger.log(
              `Removing ${platformsToDelete.length} de-authorized ${platformName} connections for user_id ${userId}. IDs: ${idsToDelete.join(', ')}`,
            );

            await tx.platform.deleteMany({
              where: { id: { in: idsToDelete } },
            });
          }

          return upsertedPlatforms;
        },
        {
          maxWait: 10000,
          timeout: 20000,
        },
      );

      const publicResults = synchronizedPlatforms.map((platform) => {
        const platformConfig = platform.config as unknown as PlatformPageConfig;
        return {
          id: platform.external_page_id,
          name: platformConfig.page_name,
          category: platformConfig.category,
          platform_db_id: platform.id,
          status: platform.status,
        };
      });

      this.logger.log(
        `Successfully synchronized ${publicResults.length} ${platformName} connection(s) for user_id ${userId}.`,
      );

      return publicResults;
    } catch (dbError: any) {
      this.logger.error(
        `Database error during ${platformName} connection synchronization for user_id ${userId}: ${dbError.message}`,
        dbError.stack,
      );

      throw new InternalServerErrorException(
        `Failed to save/update ${platformName} connections.`,
      );
    }
  }

  /**
   * Retrieves the decrypted configuration for a platform.
   * Note: Consider if this responsibility should lie with the service consuming the platform data.
   */
  async getDecryptedPlatformConfig(
    platformId: number,
  ): Promise<PlatformPageConfig | null> {
    const platform = await this.getPlatformById(platformId);
    if (!platform || !platform.config) {
      if (!platform)
        throw new NotFoundException(
          `Platform with ID ${platformId} not found.`,
        );
      this.logger.warn(`Platform with ID ${platformId} has no configuration.`);
      return null;
    }

    const config = platform.config as unknown as PlatformPageConfig;

    const decryptedConfig: PlatformPageConfig = { ...config };

    if (config.encrypted_access_token) {
      try {
        (decryptedConfig as any).access_token = this.encryptionService.decrypt(
          config.encrypted_access_token,
        );
      } catch (error) {
        this.logger.error(
          `Failed to decrypt access token for platform ID ${platformId}: ${(error as any).message}`,
        );

        throw new InternalServerErrorException(
          'Failed to decrypt sensitive platform configuration.',
        );
      }
    }
    return decryptedConfig;
  }
}
