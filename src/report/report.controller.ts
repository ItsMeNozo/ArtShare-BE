import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { Report, ReportStatus } from 'src/generated';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ViewReportsDto, ViewTab } from './dto/view-report.dto';
import { ReportService } from './report.service';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  async submitReport(
    @Body() createReportDto: CreateReportDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<{ message: string; reportId: number }> {
    const reporterId = user?.id;
    if (!reporterId) {
      throw new InternalServerErrorException(
        'Could not identify reporter from token.',
      );
    }

    const newReport: Report = await this.reportService.createReport(
      createReportDto,
      reporterId,
    );

    return {
      message: 'Report submitted successfully.',
      reportId: newReport.id,
    };
  }

  @Get('/pending')
  @ApiOperation({ summary: 'Get pending reports (Admin/Moderator)' })
  async getPendingReports(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const options = {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    };
    return this.reportService.findPendingReports(options);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: ReportStatus,
  ): Promise<Report> {
    return this.reportService.updateReportStatus(id, status);
  }

  @Patch(':id/resolve')
  async resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<Report> {
    return this.reportService.resolveReport(id, dto, user.id);
  }

  @Get('blogs')
  async getBlogsForAdmin(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<any> {
    return this.reportService.getBlogsForAdmin(page, limit);
  }

  @Post('/view')
  async viewReports(@Body() viewReportsDto: ViewReportsDto): Promise<Report[]> {
    const { tab = ViewTab.ALL, skip, take } = viewReportsDto;

    const options = {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    };

    return this.reportService.findReportsByTab(tab, options);
  }
}
