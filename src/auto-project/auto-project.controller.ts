// src/auto-project/auto-project.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { AutoProjectStatus } from 'src/generated';
import { AutoProjectReadService } from './auto-project-read.service';
import { AutoProjectWriteService } from './auto-project-write.service';
import { CreateAutoProjectDto } from './dto/request/create-project.dto';
import { GetProjectsQuery } from './dto/request/get-projects-query.dto';
import { UpdateAutoProjectDto } from './dto/request/update-project.dto';
import { AutoProjectDetailsDto } from './dto/response/auto-project-details.dto';
import { AutoProjectListItemDto } from './dto/response/auto-project-list-item.dto';

@Controller('auto-project')
@UseGuards(JwtAuthGuard)
export class AutoProjectController {
  constructor(
    private readonly autoProjectReadService: AutoProjectReadService,
    private readonly autoProjectWriteService: AutoProjectWriteService,
  ) {}

  @Post()
  async create(
    @Body() createDto: CreateAutoProjectDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<AutoProjectDetailsDto> {
    return this.autoProjectWriteService.create(createDto, user.id);
  }

  @Get()
  async findAll(
    @Query() query: GetProjectsQuery,
    @CurrentUser() user: CurrentUserType,
  ): Promise<PaginatedResponse<AutoProjectListItemDto>> {
    return this.autoProjectReadService.findAll(query, user.id);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserType,
  ): Promise<AutoProjectDetailsDto> {
    return this.autoProjectReadService.findOne(id, user.id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAutoProjectDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<AutoProjectDetailsDto> {
    return this.autoProjectWriteService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserType,
  ): Promise<void> {
    return this.autoProjectWriteService.remove(id, user.id);
  }

  @Patch(':id/pause')
  async pause(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserType,
  ): Promise<AutoProjectDetailsDto> {
    return this.autoProjectWriteService.update(
      id,
      { status: AutoProjectStatus.PAUSED },
      user.id,
    );
  }

  @Patch(':id/resume')
  async resume(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserType,
  ): Promise<AutoProjectDetailsDto> {
    return this.autoProjectWriteService.update(
      id,
      { status: AutoProjectStatus.ACTIVE },
      user.id,
    );
  }
}
