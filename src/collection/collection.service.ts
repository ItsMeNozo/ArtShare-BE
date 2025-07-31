import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Collection, Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { CreateCollectionDto } from './dto/request/create-collection.dto';
import { UpdateCollectionDto } from './dto/request/update-collection.dto';
import { CollectionDto } from './dto/response/collection.dto';
import {
  CollectionWithPosts,
  collectionWithPostsSelect,
  mapCollectionToDto,
} from './helpers/collection-mapping.helper';

@Injectable()
export class CollectionService {
  constructor(private prisma: PrismaService) {}

  async getUserCollections(userId: string): Promise<CollectionDto[]> {
    try {
      const collections = await this.prisma.collection.findMany({
        where: { userId: userId },
        select: collectionWithPostsSelect,
        orderBy: {
          createdAt: 'desc',
        },
      });

      return collections.map(mapCollectionToDto);
    } catch (error) {
      console.error('Error fetching user collections:', error);
      throw new InternalServerErrorException('Failed to fetch collections.');
    }
  }

  async getPublicCollectionsByUsername(
    username: string,
  ): Promise<CollectionDto[]> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username: username },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundException(
          `User with username '${username}' not found.`,
        );
      }

      const collections = await this.prisma.collection.findMany({
        where: {
          userId: user.id,
          isPrivate: false,
        },
        select: collectionWithPostsSelect,
        orderBy: {
          createdAt: 'desc',
        },
      });

      return collections.map(mapCollectionToDto);
    } catch (error) {
      console.error(
        `Error fetching public collections for ${username}:`,
        error,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch public collections.',
      );
    }
  }

  async createCollection(
    dto: CreateCollectionDto,
    userId: string,
  ): Promise<CollectionDto> {
    try {
      const newCollection = await this.prisma.collection.create({
        data: {
          name: dto.name.trim(),
          isPrivate: dto.isPrivate,
          description: dto.description,
          thumbnailUrl: dto.thumbnailUrl,
          user: {
            connect: { id: userId },
          },
        },
        select: collectionWithPostsSelect,
      });

      return plainToInstance(CollectionDto, newCollection);
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

  async updateCollection(
    collectionId: number,
    dto: UpdateCollectionDto,
    userId: string,
  ): Promise<CollectionDto> {
    await this.findCollectionOwnedByUser(collectionId, userId, false);

    const updateData: Prisma.CollectionUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isPrivate !== undefined) updateData.isPrivate = dto.isPrivate;
    if (dto.thumbnailUrl !== undefined)
      updateData.thumbnailUrl = dto.thumbnailUrl;

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
      return plainToInstance(CollectionDto, currentCollection);
    }

    try {
      const updatedCollection = await this.prisma.collection.update({
        where: { id: collectionId },
        data: updateData,
        select: collectionWithPostsSelect,
      });

      return plainToInstance(CollectionDto, updatedCollection);
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

  async addPostToCollection(
    collectionId: number,
    postId: number,
    userId: string,
  ): Promise<void> {
    await this.findCollectionOwnedByUser(collectionId, userId);

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found.`);
    }

    try {
      await this.prisma.postsOnCollections.create({
        data: {
          postId: postId,
          collectionId: collectionId,
        },
      });
    } catch (error) {
      console.error(
        `Error adding post ${postId} to collection ${collectionId}:`,
        error,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Post with ID ${postId} is already in this collection.`,
          );
        }

        if (error.code === 'P2003') {
          throw new NotFoundException(`Collection or Post not found.`);
        }
      }
      throw new InternalServerErrorException(
        'Failed to add post to collection.',
      );
    }
  }

  async removePostFromCollection(
    collectionId: number,
    postId: number,
    userId: string,
  ): Promise<void> {
    await this.findCollectionOwnedByUser(collectionId, userId);

    try {
      await this.prisma.postsOnCollections.delete({
        where: {
          postId_collectionId: {
            postId: postId,
            collectionId: collectionId,
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
          `Post with ID ${postId} is not in collection with ID ${collectionId}.`,
        );
      }

      throw new InternalServerErrorException(
        'Failed to remove post from collection.',
      );
    }
  }

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

    if (collection.userId !== userId) {
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
    return plainToInstance(CollectionDto, collection);
  }

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
