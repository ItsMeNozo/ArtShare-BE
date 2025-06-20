// src/reports/reports.service.ts

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Report, ReportStatus, ReportTargetType } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
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
  ) {}

  async createReport(
    createReportDto: CreateReportDto,
    reporterId: string,
  ): Promise<Report> {
    const { target_id, target_type, reason, target_url, user_id } =
      createReportDto;

    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporter_id: reporterId,
        target_type: target_type,
        status: ReportStatus.PENDING,
        ...(user_id ? { user_id: user_id } : { target_id: target_id }),
      },
    });
    if (existingReport) {
      throw new ConflictException(
        'You have already submitted a report for this item.',
      );
    }

    try {
      const newReport = await this.prisma.report.create({
        data: {
          reporter_id: reporterId,
          target_id: target_id,
          target_type: target_type,
          reason: reason,
          target_url: target_url,
        },
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
        // No moderator needed for PENDING, but if you fetch all statuses, include it
        // moderator: { select: { id: true, username: true } },
      },
      orderBy: { created_at: 'asc' },
      skip: options.skip,
      take: options.take,
    }) as Promise<ReportWithDetails[]>; // Cast for now, or ensure include always matches
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
    // If filtering by status on frontend, you might not need specific status logic here
    // unless it's for optimization or specific tabs like "Resolved".

    return this.prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, username: true } },
        moderator: { select: { id: true, username: true } }, // <<< INCLUDE MODERATOR
      },
      orderBy: { created_at: 'desc' },
      skip: options.skip,
      take: options.take,
    }) as Promise<ReportWithDetails[]>;
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
}
