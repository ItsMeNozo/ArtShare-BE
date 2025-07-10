import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { CreateLikeDto } from './dto/request/create-like.dto';
import { RemoveLikeDto } from './dto/request/remove-like.dto';
import { LikeDetailsDto } from './dto/response/like-details.dto';
import { LikesService } from './likes.service';

@Controller('likes')
@UseGuards(JwtAuthGuard)
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
