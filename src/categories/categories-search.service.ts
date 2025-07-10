import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Role } from 'src/auth/enums/role.enum';
import { JwtPayload } from 'src/auth/types/jwtPayload.type';
import { TryCatch } from 'src/common/try-catch.decorator';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { FindManyCategoriesDto } from './dto/request/find-many.dto';
import { CategoryResponseDto } from './dto/response/category.dto';

@Injectable()
export class CategoriesSearchService {
  private readonly logger = new Logger(CategoriesSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  @TryCatch()
  async findAll(
    page: number,
    pageSize: number,
    user?: JwtPayload,
  ): Promise<CategoryResponseDto[]> {
    const isAdmin = user?.roles?.includes(Role.ADMIN);
    this.logger.debug(`Is admin check result: ${isAdmin}`);

    if (isAdmin) {
      this.logger.debug('Fetching categories WITH post counts for admin...');
      // For admin users, include post counts
      const categories = await this.prisma.category.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              posts: true,
            },
          },
        },
      });

      this.logger.debug(
        `Categories with count data: ${categories[0]?._count?.posts || 0} posts`,
      );

      const result = categories.map((category) => ({
        ...category,
        postsCount: category._count.posts,
        _count: undefined, // Remove the _count object from the response
      })) as CategoryResponseDto[];

      this.logger.debug(`Final result: ${result.length} categories returned`);
      return result;
    } else {
      this.logger.debug(
        'Fetching categories WITHOUT post counts for non-admin...',
      );
      // For non-admin users, return categories without post counts
      const categories = await this.prisma.category.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      });

      return plainToInstance(CategoryResponseDto, categories);
    }
  }

  @TryCatch()
  async findAllV2(
    query: FindManyCategoriesDto,
    user?: JwtPayload,
  ): Promise<CategoryResponseDto[]> {
    const { type, searchQuery, page = 1, pageSize = 25 } = query;
    const isAdmin = user?.roles?.includes(Role.ADMIN);

    const where: Prisma.CategoryWhereInput = {};
    if (type) {
      where.type = type;
    }
    if (searchQuery) {
      where.name = {
        contains: searchQuery,
        mode: 'insensitive',
      };
    }

    if (isAdmin) {
      // For admin users, include post counts
      const categories = await this.prisma.category.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              posts: true,
            },
          },
        },
      });

      return categories.map((category) => ({
        ...category,
        postsCount: category._count.posts,
        _count: undefined, // Remove the _count object from the response
      })) as CategoryResponseDto[];
    } else {
      // For non-admin users, return categories without post counts
      const categories = await this.prisma.category.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: { createdAt: 'desc' },
      });
      return plainToInstance(CategoryResponseDto, categories);
    }
  }

  @TryCatch()
  async findOne(id: number): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new BadRequestException(`Category with id ${id} not found`);
    }
    return plainToInstance(CategoryResponseDto, category);
  }
}
