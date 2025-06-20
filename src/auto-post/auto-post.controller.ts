import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AutoPostService } from './auto-post.service';

import { Roles } from 'src/auth/decorators/roles.decorators';
import { Role } from 'src/auth/enums/role.enum';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {
  GetAutoPostsQueryDto,
  ScheduleAutoPostDto,
  UpdateAutoPostDto,
  UpdateAutoPostStatusDto,
} from './dto/auto-post.dto';

@Controller('auto-post')
export class AutoPostController {
  private readonly logger = new Logger(AutoPostController.name);
  constructor(private readonly autoPostService: AutoPostService) {}

  @Post('schedule')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async scheduleAutoPost(@Body() scheduleDto: ScheduleAutoPostDto) {
    this.logger.log(
      'Received request to schedule AutoPost for AutoProject ID:',
      scheduleDto.autoProjectId,
    );
    return this.autoPostService.createAutoPost(scheduleDto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @Get()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async getAllAutoPosts(@Query() queryDto: GetAutoPostsQueryDto) {
    this.logger.log('Received request to get all AutoPosts:', queryDto);
    return this.autoPostService.getAllAutoPosts(queryDto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  async getAutoPostById(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Received request to get AutoPost by ID: ${id}`);
    return this.autoPostService.getAutoPostById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async updateAutoPost(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAutoPostDto,
  ) {
    this.logger.log(`Received request to update AutoPost ID: ${id}`);
    return this.autoPostService.updateAutoPost(id, updateDto);
  }

  @Post('update-status')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateStatusFromN8n(@Body() updateStatusDto: UpdateAutoPostStatusDto) {
    this.logger.log(
      `Received status update from n8n for AutoPostId: ${updateStatusDto.autoPostId}, status: ${updateStatusDto.status}`,
    );
    return this.autoPostService.updateAutoPostStatus(updateStatusDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancelAutoPost(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Received request to cancel AutoPost: ${id}`);
    return this.autoPostService.cancelAutoPost(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAutoPost(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Received request to delete AutoPost ID: ${id}`);
    await this.autoPostService.deleteAutoPost(id);
  }
}
