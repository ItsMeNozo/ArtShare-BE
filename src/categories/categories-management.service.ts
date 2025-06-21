import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { TryCatch } from 'src/common/try-catch.decorator';
import embeddingConfig from 'src/config/embedding.config';
import { QdrantService } from 'src/embedding/qdrant.service';
import { PrismaService } from 'src/prisma.service';
import { CategoriesEmbeddingService } from './categories-embedding.service';
import { CreateCategoryDto } from './dto/request/create-category.dto';
import { UpdateCategoryDto } from './dto/request/update-category.dto';
import { CategoryResponseDto } from './dto/response/category.dto';

@Injectable()
export class CategoriesManagementService {
  private readonly VECTOR_DIMENSION: number;
  private readonly categoriesCollectionName;
  private readonly INVALID_DESCRIPTION_ERROR =
    'Description cannot be null or empty or contain only whitespace';

  constructor(
    @Inject(embeddingConfig.KEY)
    private embeddingConf: ConfigType<typeof embeddingConfig>,
    private readonly prisma: PrismaService,
    private readonly qdrantService: QdrantService,
    private readonly categoriesEmbeddingService: CategoriesEmbeddingService,
  ) {
    this.VECTOR_DIMENSION = this.embeddingConf.vectorDimension;
    this.categoriesCollectionName = this.embeddingConf.categoriesCollectionName;
  }

  @TryCatch()
  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    await this.validateCreateRequest(createCategoryDto);

    await this.categoriesEmbeddingService.ensureCategoriesCollectionExists();

    const createdCategory = await this.prisma.category.create({
      data: createCategoryDto,
    });

    void this.categoriesEmbeddingService.upsertCategoryEmbeddings(
      createdCategory.id,
      createdCategory.name,
      createdCategory.description,
    );

    return plainToInstance(CategoryResponseDto, createdCategory);
  }

  @TryCatch()
  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    await this.validateUpdateRequest(updateCategoryDto);

    const existingCategory = await this.checkCategoryExists(id);

    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });

    void this.categoriesEmbeddingService.updateCategoryEmbeddings(
      id,
      updateCategoryDto.name === existingCategory.name
        ? undefined
        : updateCategoryDto.name,
      updateCategoryDto.description === existingCategory.description
        ? undefined
        : updateCategoryDto.description,
    );

    return plainToInstance(CategoryResponseDto, updatedCategory);
  }

  private async validateCreateRequest(
    createCategoryDto: CreateCategoryDto,
  ): Promise<void> {
    if (this.isInvalidDescription(createCategoryDto.description)) {
      throw new BadRequestException(this.INVALID_DESCRIPTION_ERROR);
    }
  }

  private async validateUpdateRequest(
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<void> {
    if (
      updateCategoryDto.description !== undefined &&
      this.isInvalidDescription(updateCategoryDto.description)
    ) {
      throw new BadRequestException(this.INVALID_DESCRIPTION_ERROR);
    }
  }

  private isInvalidDescription(description: string): boolean {
    return description == null || description.trim() === '';
  }

  @TryCatch()
  async remove(id: number): Promise<CategoryResponseDto> {
    await this.checkCategoryExists(id);

    const deletedCategory = await this.prisma.category.delete({
      where: { id },
    });

    await this.qdrantService.deletePoints(this.categoriesCollectionName, [id]);

    return plainToInstance(CategoryResponseDto, deletedCategory);
  }

  private async checkCategoryExists(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new BadRequestException(`Category with id ${id} not found`);
    }
    return category;
  }
}
