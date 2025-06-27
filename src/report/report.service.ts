// src/reports/reports.service.ts

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Report, ReportStatus, ReportTargetType } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserService } from 'src/user/user.service';
import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
import { BlogListItemResponseDto } from 'src/blog/dto/response/blog-list-item.dto';
import { generatePaginatedResponse } from 'src/common/helpers/pagination.helper';
import { plainToInstance } from 'class-transformer';
import { ViewTab } from './dto/view-report.dto';

export type ReportWithDetails = Report & {
  reporter: { id: string; username: string };
  moderator?: { id: string; username: string } | null; // Moderator can be null
};

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userService: UserService,
  ) {}

  async createReport(
    createReportDto: CreateReportDto,
    reporterId: string,
  ): Promise<Report> {
    const {
      target_id,
      target_type,
      reason,
      target_url,
      user_id,
      target_title,
    } = createReportDto;

    try {
      const newReport = await this.prisma.report.create({
        data: {
          reporter_id: reporterId,
          target_id: target_id,
          target_type: target_type,
          reason: reason,
          target_url: target_url,
          user_id: user_id ? user_id : null,
        },
      });

      const adminUserIds = await this.userService.getAdminUserIds();

      for (const adminId of adminUserIds) {
        this.eventEmitter.emit('push-notification', {
          from: reporterId,
          to: adminId,
          type: 'report_created',
          report: {
            id: newReport.id,
            target_type: target_type,
            target_title: target_title,
          },
          createdAt: new Date(),
        });
      }

      this.eventEmitter.emit('push-notification', {
        from: reporterId,
        type: 'report_created',
        target: {
          report_id: newReport.id,
          target_type: target_type,
          target_title: target_title,
        },
        createdAt: new Date(),
      });

      return newReport;
    } catch (error) {
      console.error(`Failed to create report: ${error}`);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new NotFoundException(
            `Reporter user with ID ${reporterId} not found.`,
          );
        }
      }
      throw new InternalServerErrorException('Could not save the report.');
    }
  }

  async findPendingReports(options: {
    skip?: number;
    take?: number;
  }): Promise<ReportWithDetails[]> {
    return this.prisma.report.findMany({
      where: { status: ReportStatus.PENDING },
      include: {
        reporter: { select: { id: true, username: true } },
      },
      orderBy: { created_at: 'asc' },
      skip: options.skip,
      take: options.take,
    }) as Promise<ReportWithDetails[]>; // Cast for now, or ensure include always matches
  }

  async updateReportStatus(
    reportId: number,
    status: ReportStatus,
    // Optional: if dismissing should also assign a moderator
    // moderatorId?: string
  ): Promise<ReportWithDetails> {
    const reportExists = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!reportExists) {
      throw new NotFoundException(`Report with ID ${reportId} not found.`);
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: status,
        // If dismissing and you want to record who:
        // moderator_id: (status === ReportStatus.DISMISSED && moderatorId) ? moderatorId : reportExists.moderator_id,
        // resolved_at: (status === ReportStatus.DISMISSED) ? new Date() : reportExists.resolved_at, // Or a new 'dismissed_at' field
      },
      include: {
        // <<< INCLUDE RELATIONS
        reporter: { select: { id: true, username: true } },
        moderator: { select: { id: true, username: true } },
      },
    }) as Promise<ReportWithDetails>;
  }

  async resolveReport(
    reportId: number,
    dto: ResolveReportDto,
    currentModeratorId: string, // Renamed to avoid conflict with relation name
  ): Promise<ReportWithDetails> {
    const existingReport = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!existingReport) {
      throw new NotFoundException(`Report ${reportId} not found.`);
    }
    // if (
    //   existingReport.status === ReportStatus.RESOLVED ||
    //   existingReport.status === ReportStatus.DISMISSED
    // ) {
    //   throw new ConflictException(
    //     `Report ${reportId} has already been ${existingReport.status.toLowerCase()}.`,
    //   );
    // }

    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.RESOLVED,
        resolved_at: new Date(dto.resolve_date),
        resolution_comment: dto.resolution_comment,
        moderator_id: currentModeratorId,
      },
      include: {
        reporter: { select: { id: true, username: true } },
        moderator: { select: { id: true, username: true } },
      },
    });

    this.eventEmitter.emit('report.resolved', {
      reporterId: updatedReport.reporter_id,
      reportId: updatedReport.id,
      reason: updatedReport.reason,
      resolvedAt: updatedReport.resolved_at,
    });
    return updatedReport;
  }
  
  async getBlogsForAdmin(
    page: number,
    limit: number,
  ): Promise<PaginatedResponseDto<BlogListItemResponseDto>> {
    const skip = (page - 1) * limit;
    try {
      const [blogs, total] = await this.prisma.$transaction([
        this.prisma.blog.findMany({
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            user: {
              select : {username: true},
            }
          }
        }),
        this.prisma.blog.count(),
      ]);

      const items = plainToInstance(BlogListItemResponseDto, blogs);

      return generatePaginatedResponse(items, total, { page, limit });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new InternalServerErrorException(
        'Failed to retrieve paginated blogs',
      );
    }
  }

  async findReportsByTab(
        tab: ViewTab,
        options: { skip?: number; take?: number },
      ): Promise<ReportWithDetails[]> {
        const where: Prisma.ReportWhereInput = {};
    
        if (tab !== ViewTab.ALL) {
          if (tab !== ViewTab.USER) {
            where.target_type = tab.toUpperCase() as ReportTargetType;
          }
        }
    
        return this.prisma.report.findMany({
          where,
          include: {
            reporter: { select: { id: true, username: true } },
            moderator: { select: { id: true, username: true } },
          },
          orderBy: { created_at: 'desc' },
          skip: options.skip,
          take: options.take,
        }) as Promise<ReportWithDetails[]>;
      }
}
 