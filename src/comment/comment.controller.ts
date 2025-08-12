import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Public } from 'src/auth/decorators/public.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { Comment } from 'src/generated';
import { CurrentUser } from '../auth/decorators/users.decorator';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('create')
  @ApiOkResponse({ description: 'Comment created successfully' })
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<Comment> {
    const userId = user.id;
    return this.commentService.create(createCommentDto, userId);
  }

  @Get()
  @Public()
  @ApiOkResponse({ description: 'Comments retrieved successfully' })
  async getComments(
    @Query() query: GetCommentsQueryDto,
    @CurrentUser() user?: CurrentUserType,
  ) {
    const { targetId, targetType, parentCommentId } = query;
    return this.commentService.getComments(
      targetId,
      targetType,
      user?.id,
      parentCommentId,
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
