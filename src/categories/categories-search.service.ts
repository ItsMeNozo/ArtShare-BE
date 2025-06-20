import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { TryCatch } from 'src/common/try-catch.decorator';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { FindManyCategoriesDto } from './dto/request/find-many.dto';
import { CategoryResponseDto } from './dto/response/category.dto';

@Injectable()
export class CategoriesSearchService {
  constructor(private readonly prisma: PrismaService) {}

  @TryCatch()
  async findAll(
    page: number,
    page_size: number,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      skip: (page - 1) * page_size,
      take: page_size,
      orderBy: { created_at: 'desc' },
    });

    return plainToInstance(CategoryResponseDto, categories);
  }

  @TryCatch()
  async findAllV2(query: FindManyCategoriesDto) {
    const { type, search_query, page = 1, page_size = 25 } = query;

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

    const categories = await this.prisma.category.findMany({
      skip: (page - 1) * page_size,
      take: page_size,
      where,
      orderBy: { created_at: 'desc' },
    });

    return plainToInstance(CategoryResponseDto, categories);
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
