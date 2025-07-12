import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/auth/optional-jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { SyncEmbeddingResponseDto } from '../common/response/sync-embedding.dto';
import { CategoriesEmbeddingService } from './categories-embedding.service';
import { CategoriesManagementService } from './categories-management.service';
import { CategoriesSearchService } from './categories-search.service';
import { CreateCategoryDto } from './dto/request/create-category.dto';
import { FindManyCategoriesDto } from './dto/request/find-many.dto';
import { UpdateCategoryDto } from './dto/request/update-category.dto';
import { CategoryResponseDto } from './dto/response/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesSearchService: CategoriesSearchService,
    private readonly categoriesManagementService: CategoriesManagementService,
    private readonly categoriesEmbeddingService: CategoriesEmbeddingService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN) // TODO: uncomment when huy fix
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesManagementService.create(createCategoryDto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(
    @Request() req: any,
    @Query() paginationQuery: PaginationQueryDto,
  ): Promise<PaginatedResponse<CategoryResponseDto>> {
    return this.categoriesSearchService.findAll(paginationQuery, req.user);
  }

  @Get('v2')
  @UseGuards(OptionalJwtAuthGuard)
  async findAllV2(
    @Request() req: any,
    @Query() query: FindManyCategoriesDto,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesSearchService.findAllV2(query, req.user);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CategoryResponseDto> {
    return this.categoriesSearchService.findOne(Number(id));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN) // TODO: uncomment when huy fix
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesManagementService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN) // TODO: uncomment when huy fix
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CategoryResponseDto> {
    return this.categoriesManagementService.remove(id);
  }

  @Post('sync-embeddings')
  async syncEmbeddings(): Promise<SyncEmbeddingResponseDto> {
    return this.categoriesEmbeddingService.syncCategoriesEmbeddings();
  }
}
