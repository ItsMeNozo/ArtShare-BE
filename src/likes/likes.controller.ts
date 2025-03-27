import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { LikesService } from './likes.service';
import { CreateLikeDto } from './dto/request/create-like.dto';
import { RemoveLikeDto } from './dto/request/remove-like.dto';
import { LikeDetailsDto } from './dto/response/like-details.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { CurrentUserType } from 'src/auth/types/current-user.type';

@Controller('likes')
@UseGuards(AuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  async createLike(
    @Body() createLikeDto: CreateLikeDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<LikeDetailsDto> {
    return this.likesService.createLike(createLikeDto, user.id);
  }

  @Delete()
  async removeLike(
    @Body() removeLikeDto: RemoveLikeDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.likesService.removeLike(removeLikeDto, user.id);
  }
}
