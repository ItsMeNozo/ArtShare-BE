import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { Platform, SharePlatform } from 'src/generated';
import { CreatePlatformDto } from './dtos/create-platform.dto';
import { UpdatePlatformConfigDto } from './dtos/update-platform-config.dto';
import { PlatformService } from './platform.service';

@UseGuards(JwtAuthGuard)
@Controller('platforms')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Roles(Role.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createPlatformDto: CreatePlatformDto,
  ): Promise<Platform> {
    return this.platformService.createPlatform(createPlatformDto);
  }

  @Get()
  async findAllForUser(
    @CurrentUser() user: CurrentUserType,
    @Query('platformName') platformName?: SharePlatform,
  ): Promise<Platform[]> {
    if (platformName) {
      return this.platformService.findPlatformsByUserIdAndName(
        user.id,
        platformName,
      );
    }
    return this.platformService.findPlatformsByUserId(user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Platform> {
    const platform = await this.platformService.getPlatformById(id);
    if (!platform) {
      throw new NotFoundException(`Platform with ID ${id} not found.`);
    }

    return platform;
  }

  @Roles(Role.ADMIN)
  @Get(':id/decrypted-config')
  async getDecryptedConfig(@Param('id', ParseIntPipe) id: number) {
    const platform = await this.platformService.getPlatformById(id);
    if (!platform) {
      throw new NotFoundException(`Platform with ID ${id} not found.`);
    }

    return this.platformService.getDecryptedPlatformConfig(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/config')
  async updateConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePlatformConfigDto: UpdatePlatformConfigDto,
  ): Promise<Platform> {
    return this.platformService.updatePlatformConfig(
      id,
      updatePlatformConfigDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.platformService.deletePlatform(id);
  }

  /*
  @Post('synchronize')
  @UseGuards(AdminGuard) 
  async synchronize(
    @Body() syncInput: SyncPlatformInputDto 
  ): Promise<PublicPlatformOutputDto[]> {
    return this.platformService.synchronizePlatforms(syncInput);
  }
  */
}
