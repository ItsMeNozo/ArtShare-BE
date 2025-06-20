import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { TryCatch } from 'src/common/try-catch.decorator';
import { PrismaService } from 'src/prisma.service';
import { AutoProjectDetailsDto } from './dto/response/auto-project-details.dto';
import { AutoProjectListResponseDto } from './dto/response/auto-project-list-item.dto';
import { mapToAutoProjectDetailsDto } from './mapper/index.mapper';

type SortableProjectKey = 'title' | 'status' | 'created_at';
const allowedSortKeys: SortableProjectKey[] = ['title', 'status', 'created_at'];

@Injectable()
export class AutoProjectReadService {
  constructor(private readonly prisma: PrismaService) {}

  @TryCatch()
  async findAll(
    page: number,
    pageSize: number,
    userId: string,
    sortBy: string = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<AutoProjectListResponseDto> {
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    let orderByCondition: Prisma.AutoProjectOrderByWithRelationInput = {
      created_at: 'desc',
    };

    if (allowedSortKeys.includes(sortBy as SortableProjectKey)) {
      orderByCondition = { [sortBy]: sortOrder };
    } else if (sortBy === 'autoPosts') {
      orderByCondition = { autoPosts: { _count: sortOrder } };
    }

    const where: Prisma.AutoProjectWhereInput = { user_id: userId };

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.autoProject.findMany({
        skip,
        take,
        where,
        orderBy: orderByCondition,
        include: {
          platform: true,
          _count: {
            select: {
              autoPosts: true,
            },
          },
        },
      }),
      this.prisma.autoProject.count({ where }),
    ]);

    const projectIds = projects.map((p) => p.id);
    let nextPostMap = new Map<number, Date | null>();

    if (projectIds.length > 0) {
      const nextPosts = await this.prisma.autoPost.groupBy({
        by: ['auto_project_id'],
        where: {
          auto_project_id: { in: projectIds },
          status: 'PENDING',
          scheduled_at: { gt: new Date() },
        },
        _min: {
          scheduled_at: true,
        },
      });
      nextPostMap = new Map(
        nextPosts.map((p) => [p.auto_project_id, p._min.scheduled_at]),
      );
    }

    const projectsWithNextPost = projects.map((p) => ({
      ...p,
      nextPostAt: nextPostMap.get(p.id) || null,
    }));

    return plainToInstance(AutoProjectListResponseDto, {
      projects: projectsWithNextPost,
      total,
    });
  }

  @TryCatch()
  async findOne(id: number, userId: string): Promise<AutoProjectDetailsDto> {
    const autoProject = await this.prisma.autoProject.findFirst({
      where: {
        id,
        user_id: userId,
      },
      include: {
        platform: true,
      },
    });

    if (!autoProject) {
      throw new BadRequestException('Auto project not found');
    }

    return mapToAutoProjectDetailsDto(autoProject);
  }
}
