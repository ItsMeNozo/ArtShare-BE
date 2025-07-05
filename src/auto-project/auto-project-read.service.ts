import { BadRequestException, Injectable } from '@nestjs/common';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { generatePaginatedResponse } from 'src/common/helpers/pagination.helper';
import { TryCatch } from 'src/common/try-catch.decorator';
import { Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { GetProjectsQuery } from './dto/request/get-projects-query.dto';
import { AutoProjectDetailsDto } from './dto/response/auto-project-details.dto';
import { AutoProjectListItemDto } from './dto/response/auto-project-list-item.dto';
import { SortableProjectKey } from './enum/index.enum';
import {
  mapToAutoProjectDetailsDto,
  mapToAutoProjectListItemsDto,
} from './mapper/index.mapper';
import { RawProjectResult } from './types/index.type';

@Injectable()
export class AutoProjectReadService {
  constructor(private readonly prisma: PrismaService) {}

  @TryCatch()
  async findAll(
    query: GetProjectsQuery,
    userId: string,
  ): Promise<PaginatedResponse<AutoProjectListItemDto>> {
    const {
      page = 1,
      limit = 10,
      sortBy = SortableProjectKey.CREATED_AT,
      sortOrder = 'desc',
    } = query;

    const offset = (page - 1) * limit;
    const where: Prisma.AutoProjectWhereInput = { userId: userId };
    const orderByClause = this.getOrderByClause(sortBy, sortOrder);

    const projectsQuery = Prisma.sql`
      SELECT
        p.id,
        p.title,
        p.status,
        plat.id AS "platformId",
        plat.name AS "platformName",
        p."createdAt",
        p."updatedAt",
        
        (SELECT COUNT(*) FROM "AutoPost" WHERE "autoProjectId" = p.id)::INT AS "postCount",
        
        -- Subquery to get the next scheduled post date
        (
          SELECT MIN(ap."scheduledAt")
          FROM "AutoPost" ap
          WHERE ap."autoProjectId" = p.id
            AND ap.status = 'PENDING'
            AND ap."scheduledAt" > NOW()
        ) AS "nextPostAt"
      FROM
        "AutoProject" AS p
      LEFT JOIN
        "Platform" AS plat ON p."platformId" = plat.id
      WHERE
        p."userId" = ${userId}
      ${orderByClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.$queryRaw<RawProjectResult[]>(projectsQuery),
      this.prisma.autoProject.count({ where }),
    ]);

    if (total === 0) {
      return generatePaginatedResponse([], 0, { page, limit });
    }

    const mappedProjects = mapToAutoProjectListItemsDto(projects);

    return generatePaginatedResponse(mappedProjects, total, {
      page,
      limit,
    });
  }

  private getOrderByClause(
    sortBy: SortableProjectKey,
    sortOrder: 'asc' | 'desc',
  ): Prisma.Sql {
    const columnMap: Record<SortableProjectKey, string> = {
      [SortableProjectKey.TITLE]: 'p.title',
      [SortableProjectKey.STATUS]: 'p.status',
      [SortableProjectKey.CREATED_AT]: 'p.created_at',
      [SortableProjectKey.POST_COUNT]: '"postCount"',
      [SortableProjectKey.NEXT_POST_AT]: '"nextPostAt"',
    };
    const sortColumn = columnMap[sortBy];

    const nullsClause =
      sortBy === SortableProjectKey.NEXT_POST_AT
        ? sortOrder === 'desc'
          ? 'NULLS LAST'
          : 'NULLS FIRST'
        : '';

    return Prisma.sql`ORDER BY ${Prisma.raw(
      sortColumn,
    )} ${Prisma.raw(sortOrder)} ${Prisma.raw(nullsClause)}`;
  }

  @TryCatch()
  async findOne(id: number, userId: string): Promise<AutoProjectDetailsDto> {
    const autoProject = await this.prisma.autoProject.findFirst({
      where: {
        id,
        userId: userId,
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
