import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  HttpCode,
  Query,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import { Blog } from '@prisma/client';

@Controller('blogs')
export class BlogController {
  constructor(private blogService: BlogService) {}

  @Get()
  async getBlogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Request() req: any,
  ): Promise<Blog[]> {
    const userId = req.user?.id || null;

    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

    if (isNaN(take) || isNaN(skip) || take <= 0 || skip < 0) {
      throw new Error('Invalid pagination parameters');
    }

    return this.blogService.getBlogs(userId, take, skip);
  }

  @Get('me')
  async getMyBlogs(@Request() req: any): Promise<Blog[]> {
    const userId = req.user.id;
    return this.blogService.findMyBlogs(userId);
  }

  @Post()
  async createBlog(
    @Body() body: { user_id: number; title: string; content: string },
  ): Promise<Blog> {
    return this.blogService.createBlog(body);
  }

  @Patch(':id')
  async updateBlog(
    @Param('id') id: string,
    @Body() body: { title: string; content: string },
  ): Promise<Blog> {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error('Invalid blog ID');
    }

    const existingBlog = await this.blogService.findBlogById(numericId);
    if (existingBlog) {
      return this.blogService.updateBlog(numericId, body);
    } else {
      throw new Error('Blog not found');
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteBlog(@Param('id') id: string): Promise<void> {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error('Invalid blog ID');
    }

    await this.blogService.deleteBlog(numericId);
  }
}
