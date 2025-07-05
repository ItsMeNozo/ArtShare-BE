import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma.service";
import { CreatePostRequestDto } from "../dto/request/create-post.dto";

@Injectable()
export class PostsManagementValidator {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async validateCreateRequest(
    request: CreatePostRequestDto,
    images: Express.Multer.File[],
  ): Promise<{ parsedCropMeta: any }> {
    const { categoryIds = [], videoUrl } = request;

    console.log(request.thumbnailCropMeta);
    // Validate and parse crop metadata
    // TODO: should define a proper type for this crop metadata
    let parsedCropMeta: any;
    try {
      parsedCropMeta = JSON.parse(request.thumbnailCropMeta);
    } catch {
      throw new BadRequestException('Invalid thumbnailCropMeta JSON');
    }

    // Ensure at least one media provided
    if (!videoUrl && images.length === 0) {
      throw new BadRequestException(
        'Provide videoUrl or upload at least one image',
      );
    }

    // Validate category IDs
    if (categoryIds.length > 0) {
      const existingCategoriesCount = await this.prisma.category.count({
        where: {
          id: { in: categoryIds },
        },
      });
      if (existingCategoriesCount !== categoryIds.length) {
        throw new BadRequestException('One or more category IDs are invalid');
      }
    }

    return { parsedCropMeta };
  }
}
