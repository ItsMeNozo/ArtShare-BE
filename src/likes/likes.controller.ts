import { Controller, Post, Delete, Body } from '@nestjs/common';
import { LikesService } from './likes.service';
import { CreateLikeDto } from './dto/create-like.dto';
import { RemoveLikeDto } from './dto/remove-like.dto';

@Controller('likes')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post()
  async createLike(@Body() createLikeDto: CreateLikeDto) {
    const userId = 1;
    return this.likesService.createLike(createLikeDto, userId);
  }

  @Delete()
  async removeLike(@Body() removeLikeDto: RemoveLikeDto) {
    const userId = 1;
    return this.likesService.removeLike(removeLikeDto, userId);
  }
}
