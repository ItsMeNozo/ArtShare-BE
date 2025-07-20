import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { CreateShareDto } from './dto/request/create-share.dto';
import { SharesService } from './shares.service';

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  async createShare(
    @Body() createShareDto: CreateShareDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.sharesService.createShare(createShareDto, user.id);
  }
}
