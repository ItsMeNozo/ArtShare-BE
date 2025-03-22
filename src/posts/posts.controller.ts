import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto } from './dto/post-request.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  CreatePostResponseDto,
  PostDetailsResponseDto,
} from './dto/post-response.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('images'))
  async createPost(
    @Body() createPostDto: CreatePostDto,
  ): Promise<CreatePostResponseDto> {
    // TODO: will extract from accesstoken
    const userId = 1;
    return this.postsService.createPost(createPostDto, userId);
  }

  @Patch(':post_id')
  @UseInterceptors(FilesInterceptor('images'))
  async updatePost(
    @Param('post_id') postId: number,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    // TODO: will extract from accesstoken
    const userId = 1;
    return this.postsService.updatePost(Number(postId), updatePostDto, userId);
  }

  @Delete(':post_id')
  async deletePost(@Param('post_id') postId: number) {
    return this.postsService.deletePost(Number(postId));
  }

  @Get('search')
  async searchPosts(@Query('q') query: string) {
    return this.postsService.searchPosts(query);
  }

  @Get(':post_id')
  async getPostDetails(
    @Param('post_id') postId: number,
  ): Promise<PostDetailsResponseDto> {
    return this.postsService.getPostDetails(Number(postId));
  }

  @Get('trending')
  async getForYouPosts() {
    // TODO: get user_id from access token
    const userId = 1;
    return this.postsService.getForYouPosts(userId);
  }

  @Get('following')
  async getFollowingPosts(@Query('filter') filter?: string) {
    // TODO: get user_id from access token
    const userId = 1;
    return this.postsService.getFollowingPosts(Number(userId), filter);
  }


}
