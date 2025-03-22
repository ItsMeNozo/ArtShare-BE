import { Controller, Post, Body, Delete } from '@nestjs/common';
import { SharesService } from './shares.service';
import { CreateShareDto } from './dto/create-share.dto';
import { RemoveShareDto } from './dto/remove-share.dto';

@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  async createShare(@Body() createShareDto: CreateShareDto) {
    // will extract userId from access token
    const userId = 1;
    return this.sharesService.createShare(createShareDto, userId);
  }

  @Delete()
  async removeShare(@Body() removeShareDto: RemoveShareDto) {
    // will extract userId from access token
    const userId = 1;
    return this.sharesService.removeShare(removeShareDto, userId);
  }
}
