import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  ParseIntPipe,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import { CreateBlogDto } from './dto/request/create-blog.dto';
import { UpdateBlogDto } from './dto/request/update-blog.dto';
import { GetBlogsQueryDto } from './dto/request/get-blogs-query.dto';
import { RateBlogDto } from './dto/request/rate-blog.dto';

import { BlogListItemResponseDto } from './dto/response/blog-list-item.dto';
import { BlogDetailsResponseDto } from './dto/response/blog-details.dto';
import { BookmarkResponseDto } from './dto/response/bookmark-response.dto';
import { ProtectResponseDto } from './dto/response/protect-response.dto';
import { RatingResponseDto } from './dto/response/rating-response.dto';

import { AuthGuard } from 'src/auth/auth.guard';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { CurrentUserType } from 'src/auth/types/current-user.type';

@Controller('blogs')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  /**
   * GET /blogs - Get list of published blogs (paginated, searchable)
   */
  @Get()
  async getBlogs(
    @Query() query: GetBlogsQueryDto,
  ): Promise<BlogListItemResponseDto[]> {
    const { take, skip, search } = query;
    const finalTake = take ?? 10;
    const finalSkip = skip ?? 0;
    return this.blogService.getBlogs(finalTake, finalSkip, search);
  }

  /**
   * GET /blogs/trending - Get globally trending blogs, optionally filtered by categories
   */
  @Get('trending')
  async getTrendingBlogs(
    @Query() query: GetBlogsQueryDto,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<BlogListItemResponseDto[]> {
    const { take, skip, categories } = query;
    const finalTake = take ?? 10;
    const finalSkip = skip ?? 0;

    return this.blogService.getTrendingBlogs(
      finalTake,
      finalSkip,
      categories,
      user?.id,
    );
  }

  /**
   * GET /blogs/following - Get blogs from followed users, optionally filtered by categories
   */
  @UseGuards(AuthGuard)
  @Get('following')
  async getFollowingBlogs(
    @Query() query: GetBlogsQueryDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BlogListItemResponseDto[]> {
    const { take, skip, categories } = query;
    const finalTake = take ?? 10;
    const finalSkip = skip ?? 0;

    return this.blogService.getFollowingBlogs(
      user.id,
      finalTake,
      finalSkip,
      categories,
    );
  }

  /**
   * GET /blogs/search - Search blogs by query param 'q'
   */
  @Get('search')
  async searchBlogs(
    @Query('q') searchQuery: string,
    @Query() queryDto: GetBlogsQueryDto,
  ): Promise<BlogListItemResponseDto[]> {
    const { take, skip } = queryDto;
    const finalTake = take ?? 10;
    const finalSkip = skip ?? 0;

    return this.blogService.getBlogs(finalTake, finalSkip, searchQuery);
  }

  /**
   * GET /blogs/me - Get blogs created by the current user
   */
  @UseGuards(AuthGuard)
  @Get('me')
  async findMyBlogs(
    @CurrentUser() user: CurrentUserType,
  ): Promise<BlogListItemResponseDto[]> {
    return this.blogService.findMyBlogs(user.id);
  }

  /**
   * GET /blogs/{id} - Get blog details by ID
   */
  @Get(':id')
  async findBlogById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<BlogDetailsResponseDto> {
    const blog = await this.blogService.findBlogById(id, user?.id);
    if (!blog) {
      throw new NotFoundException(
        `Blog with ID ${id} not found or access denied.`,
      );
    }
    return blog;
  }

  /**
   * POST /blogs - Create a new blog post (Standard REST, replaces /blogs/create)
   */
  @UseGuards(AuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBlog(
    @Body() createBlogDto: CreateBlogDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BlogDetailsResponseDto> {
    return this.blogService.createBlog(createBlogDto, user.id);
  }

  /**
   * PATCH /blogs/{id} - Update an existing blog post
   */
  @UseGuards(AuthGuard)
  @Patch(':id')
  async updateBlog(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBlogDto: UpdateBlogDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BlogDetailsResponseDto> {
    return this.blogService.updateBlog(id, updateBlogDto, user.id);
  }

  /**
   * DELETE /blogs/{id} - Delete a blog post
   */
  @UseGuards(AuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteBlog(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserType,
  ): Promise<{ message: string }> {
    await this.blogService.deleteBlog(id, user.id);
    return { message: `Blog with ID ${id} successfully deleted.` };
  }

  /**
   * POST /blogs/{id}/bookmark - Toggle bookmark status for a blog
   */
  @UseGuards(AuthGuard)
  @Post(':id/bookmark')
  @HttpCode(HttpStatus.OK)
  async toggleBookmark(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserType,
  ): Promise<BookmarkResponseDto> {
    return this.blogService.toggleBookmark(id, user.id);
  }

  /**
   * POST /blogs/{id}/protect - Apply protection (details TBD)
   */
  @UseGuards(AuthGuard)
  @Post(':id/protect')
  @HttpCode(HttpStatus.OK)
  async protectBlog(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserType,
  ): Promise<ProtectResponseDto> {
    return this.blogService.protectBlog(id, user.id /*, protectDto? */);
  }

  /**
   * POST /blogs/{id}/rate - Rate a blog
   */
  @UseGuards(AuthGuard)
  @Post(':id/rate')
  @HttpCode(HttpStatus.OK)
  async rateBlog(
    @Param('id', ParseIntPipe) id: number,
    @Body() rateBlogDto: RateBlogDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<RatingResponseDto> {
    return this.blogService.rateBlog(id, user.id, rateBlogDto.rating);
  }
}
