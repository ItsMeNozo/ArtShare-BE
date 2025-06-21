import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from 'src/auth/decorators/public.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
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
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('page_size', new DefaultValuePipe(25), ParseIntPipe)
    page_size: number,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesSearchService.findAll(page, page_size);
  }

  @Get('v2')
  @Public()
  async findAllV2(
    @Query() query: FindManyCategoriesDto,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesSearchService.findAllV2(query);
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
