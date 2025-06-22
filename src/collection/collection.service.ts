import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Collection, Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { CreateCollectionDto } from './dto/request/create-collection.dto';
import { UpdateCollectionDto } from './dto/request/update-collection.dto';
import { CollectionDto } from './dto/response/collection.dto';
import {
  CollectionWithPosts,
  collectionWithPostsSelect,
  mapCollectionToDto,
  SelectedCollectionPayload,
} from './helpers/collection-mapping.helper';

@Injectable()
export class CollectionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Fetches all collections belonging to a specific user, including their posts.
   * Collections and their posts are sorted by creation date (desc).
   */
  async getUserCollections(userId: string): Promise<CollectionDto[]> {
    try {
      const collections = await this.prisma.collection.findMany({
        where: { user_id: userId },
        select: collectionWithPostsSelect,
        orderBy: {
          created_at: 'desc',
        },
      });

      return collections.map(mapCollectionToDto);
    } catch (error) {
      console.error('Error fetching user collections:', error);
      throw new InternalServerErrorException('Failed to fetch collections.');
    }
  }

  /**
   * Creates a new collection for a specific user.
   */
  async createCollection(
    dto: CreateCollectionDto,
    userId: string,
  ): Promise<CollectionDto> {
    try {
      const newCollection = await this.prisma.collection.create({
        data: {
          name: dto.name.trim(),
          is_private: dto.is_private,
          description: dto.description,
          thumbnail_url: dto.thumbnail_url,
          user: {
            connect: { id: userId },
          },
        },
        select: collectionWithPostsSelect,
      });

      return mapCollectionToDto(newCollection as CollectionWithPosts);
    } catch (error) {
      console.error('Error creating collection:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'A collection with this name already exists.',
          );
        }
      }
      throw new InternalServerErrorException('Failed to create collection.');
    }
  }

  /**
   * Updates general properties (name, description, privacy, thumbnail)
   * of a specific collection if the user owns it.
   */
  async updateCollection(
    collectionId: number,
    dto: UpdateCollectionDto,
    userId: string,
  ): Promise<CollectionDto> {
    await this.findCollectionOwnedByUser(collectionId, userId, false);

    const updateData: Prisma.CollectionUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isPrivate !== undefined) updateData.is_private = dto.isPrivate;
    if (dto.thumbnail_url !== undefined)
      updateData.thumbnail_url = dto.thumbnail_url;

    if (Object.keys(updateData).length === 0) {
      console.warn(
        `Update called for collection ${collectionId} with no actual changes.`,
      );
      const currentCollection = await this.prisma.collection.findUnique({
        where: { id: collectionId },
        select: collectionWithPostsSelect,
      });
      if (!currentCollection) {
        throw new NotFoundException(
          `Collection with ID ${collectionId} not found after ownership check.`,
        );
      }
      return mapCollectionToDto(currentCollection as SelectedCollectionPayload);
    }

    try {
      const updatedCollection = await this.prisma.collection.update({
        where: { id: collectionId },
        data: updateData,
        select: collectionWithPostsSelect,
      });

      return mapCollectionToDto(updatedCollection as SelectedCollectionPayload);
    } catch (error) {
      console.error(`Error updating collection ${collectionId}:`, error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(
            `Collection with ID ${collectionId} not found.`,
          );
        }
      }
      throw new InternalServerErrorException('Failed to update collection.');
    }
  }

  /**
   * Adds a specific post to a specific collection if the user owns the collection.
   */
  async addPostToCollection(
    collectionId: number,
    postId: number,
    userId: string,
  ): Promise<void> {
    await this.findCollectionOwnedByUser(collectionId, userId);

    try {
      await this.prisma.collection.update({
        where: { id: collectionId },
        data: {
          posts: {
            connect: { id: postId },
          },
        },
      });
    } catch (error) {
      console.error(
        `Error adding post ${postId} to collection ${collectionId}:`,
        error,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          const postExists = await this.prisma.post.findUnique({
            where: { id: postId },
            select: { id: true },
          });
          if (!postExists) {
            throw new NotFoundException(`Post with ID ${postId} not found.`);
          } else {
            throw new NotFoundException(
              `Collection with ID ${collectionId} not found or failed to connect post.`,
            );
          }
        }
      }
      throw new InternalServerErrorException(
        'Failed to add post to collection.',
      );
    }
  }

  /**
   * Removes a specific post from a specific collection if the user owns the collection.
   */
  async removePostFromCollection(
    collectionId: number,
    postId: number,
    userId: string,
  ): Promise<void> {
    await this.findCollectionOwnedByUser(collectionId, userId);

    try {
      await this.prisma.collection.update({
        where: {
          id: collectionId,

          posts: { some: { id: postId } },
        },
        data: {
          posts: {
            disconnect: { id: postId },
          },
        },
      });
    } catch (error) {
      console.error('Error removing post from collection:', error);

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `Collection with ID ${collectionId} not found, or post with ID ${postId} not associated with it.`,
        );
      }

      throw new InternalServerErrorException(
        'Failed to remove post from collection.',
      );
    }
  }

  /**
   * Finds a collection by ID and verifies ownership. Throws if not found or not owned.
   * Optionally includes posts in the returned object.
   */
  private async findCollectionOwnedByUser(
    collectionId: number,
    userId: string,
    includePosts = false,
  ): Promise<Collection | CollectionWithPosts> {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: { posts: includePosts },
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection with ID ${collectionId} not found.`,
      );
    }

    if (collection.user_id !== userId) {
      throw new ForbiddenException(
        `You do not have permission to access collection ${collectionId}.`,
      );
    }

    return collection;
  }

  async getCollectionDetails(
    collectionId: number,
    userId: string,
  ): Promise<CollectionDto> {
    const collection = await this.findCollectionOwnedByUser(
      collectionId,
      userId,
      true,
    );
    return mapCollectionToDto(collection as CollectionWithPosts);
  }

  /**
   * Deletes a specific collection if the user owns it.
   */
  async removeCollection(collectionId: number, userId: string): Promise<void> {
    await this.findCollectionOwnedByUser(collectionId, userId);

    try {
      await this.prisma.collection.delete({
        where: { id: collectionId },
      });
    } catch (error) {
      console.error(`Error deleting collection ${collectionId}:`, error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(
            `Collection with ID ${collectionId} not found.`,
          );
        }
      }
      throw new InternalServerErrorException('Failed to delete collection.');
    }
  }
}
