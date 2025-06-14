import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  Get,
  Query,
  Patch,
  Param,
  ParseIntPipe,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ApiOperation } from '@nestjs/swagger';
import { Comment } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Public } from 'src/auth/decorators/public.decorator';
import { GetCommentsDto } from './dto/request/get-comments.dto';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('create')
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<Comment> {
    const userId = currentUser.id;
    return this.commentService.create(createCommentDto, userId);
  }

  @Get()
  @Public()
  async getComments(
    @Query() query: GetCommentsDto,
    @CurrentUser() currentUser?: CurrentUserType,
  ) {
    return this.commentService.getComments(
      query.target_id,
      query.target_type,
      currentUser?.id,
      query.parent_comment_id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit your own comment' })
  async updateComment(
    @Param('id', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<Comment> {
    return this.commentService.update(commentId, dto, user.id);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('id', ParseIntPipe) commentId: number,
    @CurrentUser() user: CurrentUserType,
  ): Promise<void> {
    await this.commentService.remove(commentId, user.id);
  }

  @Post(':commentId/like')
  async like(
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() user: CurrentUserType,
  ) {
    await this.commentService.likeComment(user.id, commentId);
    return { success: true };
  }

  @Post(':commentId/unlike')
  async unlike(
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() user: CurrentUserType,
  ) {
    await this.commentService.unlikeComment(user.id, commentId);
    return { success: true };
  }
}
