import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { TryCatch } from 'src/common/try-catch.decorator';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { Role } from 'src/auth/enums/role.enum';
import { JwtPayload } from 'src/auth/types/jwtPayload.type';
import { FindManyCategoriesDto } from './dto/request/find-many.dto';
import { CategoryResponseDto } from './dto/response/category.dto';

@Injectable()
export class CategoriesSearchService {
  constructor(private readonly prisma: PrismaService) {}

  @TryCatch()
  async findAll(
    page: number,
    page_size: number,
    user?: JwtPayload,
  ): Promise<CategoryResponseDto[]> {
    const isAdmin = user?.roles?.includes(Role.ADMIN);
    console.log('Is admin check result:', isAdmin);
    
    if (isAdmin) {
      console.log('Fetching categories WITH post counts for admin...');
      // For admin users, include post counts
      const categories = await this.prisma.category.findMany({
        skip: (page - 1) * page_size,
        take: page_size,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: {
              posts: true,
            },
          },
        },
      });

      console.log('Categories with count data:', categories[0]?._count);
      
      const result = categories.map(category => ({
        ...category,
        posts_count: category._count.posts,
        _count: undefined, // Remove the _count object from the response
      })) as CategoryResponseDto[];
      
      console.log('Final result sample:', result[0]);
      return result;
    } else {
      console.log('Fetching categories WITHOUT post counts for non-admin...');
      // For non-admin users, return categories without post counts
      const categories = await this.prisma.category.findMany({
        skip: (page - 1) * page_size,
        take: page_size,
        orderBy: { created_at: 'desc' },
      });

      return plainToInstance(CategoryResponseDto, categories);
    }
  }

  @TryCatch()
  async findAllV2(query: FindManyCategoriesDto, user?: JwtPayload) {
    const { type, search_query, page = 1, page_size = 25 } = query;
    const isAdmin = user?.roles?.includes(Role.ADMIN);

    const where: Prisma.CategoryWhereInput = {};
    if (type) {
      where.type = type;
    }
    if (search_query) {
      where.name = {
        contains: search_query,
        mode: 'insensitive',
      };
    }

    if (isAdmin) {
      // For admin users, include post counts
      const categories = await this.prisma.category.findMany({
        skip: (page - 1) * page_size,
        take: page_size,
        where,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: {
              posts: true,
            },
          },
        },
      });

      return categories.map(category => ({
        ...category,
        posts_count: category._count.posts,
        _count: undefined, // Remove the _count object from the response
      })) as CategoryResponseDto[];
    } else {
      // For non-admin users, return categories without post counts
      const categories = await this.prisma.category.findMany({
        skip: (page - 1) * page_size,
        take: page_size,
        where,
        orderBy: { created_at: 'desc' },
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
