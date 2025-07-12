import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Role } from 'src/auth/enums/role.enum';
import { JwtPayload } from 'src/auth/types/jwtPayload.type';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { TryCatch } from 'src/common/try-catch.decorator';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { CategoryType } from './dto/request/create-category.dto';
import { FindManyCategoriesDto } from './dto/request/find-many.dto';
import { CategorySimpleDto } from './dto/response/category-simple.dto';
import { CategoryResponseDto } from './dto/response/category.dto';

@Injectable()
export class CategoriesSearchService {
  private readonly logger = new Logger(CategoriesSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  @TryCatch()
  async findAll(
    query: { type?: CategoryType },
    user?: JwtPayload,
  ): Promise<CategoryResponseDto[]> {
    const isAdmin = user?.roles?.includes(Role.ADMIN);

    const where: Prisma.CategoryWhereInput = {
      type: query.type,
    };

    const categories = await this.prisma.category.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: isAdmin ? { _count: { select: { posts: true } } } : undefined,
    });

    this.logger.debug(`Found ${categories.length} matching categories.`);

    const result = categories.map((category) => ({
      ...(category as any),
      postsCount: (category as any)._count?.posts,
      _count: undefined,
    })) as CategoryResponseDto[];

    return result;
  }

  @TryCatch()
  async findAllPaginated(
    paginationQuery: PaginationQueryDto,
    user?: JwtPayload,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      filter,
    } = paginationQuery;
    const isAdmin = user?.roles?.includes(Role.ADMIN);

    const where: Prisma.CategoryWhereInput = {
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
      type: filter?.type,
    };

    const orderBy = { [sortBy]: sortOrder };

    const [total, categories] = await this.prisma.$transaction([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: isAdmin ? { _count: { select: { posts: true } } } : undefined,
      }),
    ]);

    this.logger.debug(
      `Found ${total} matching categories, returning page ${page}`,
    );

    const result = categories.map((category) => ({
      ...(category as any),
      postsCount: (category as any)._count?.posts,
      _count: undefined,
    })) as CategoryResponseDto[];

    return new PaginatedResponse(result, total, page, limit);
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
        _count: undefined,
      })) as CategoryResponseDto[];
    } else {
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

  async findAllSimple(): Promise<CategorySimpleDto[]> {
    this.logger.debug(
      'Fetching simple list of categories (id and name only)...',
    );

    const categories = await this.prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
      },
    });

    return categories;
  }
}
