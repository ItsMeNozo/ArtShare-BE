import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/request/create-post.dto';
import { PostDetailsResponseDto } from './dto/response/post-details.dto';
import { UpdatePostDto } from './dto/request/update-post.dto';
import { PostListItemResponseDto } from './dto/response/post-list-item.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from 'src/auth/auth.guard';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { CurrentUserType } from 'src/auth/types/current-user.type';

@UseGuards(AuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('images'))
  async createPost(
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles() images: Express.Multer.File[],
    @CurrentUser() user: CurrentUserType,
  ): Promise<any> {
    return this.postsService.createPost(createPostDto, images, user.id);
  }

  @Patch(':post_id')
  @UseInterceptors(FilesInterceptor('images'))
  async updatePost(
    @Param('post_id') postId: number,
    @Body() updatePostDto: UpdatePostDto,
    @UploadedFiles() images: Express.Multer.File[],
    @CurrentUser() user: CurrentUserType,
  ): Promise<PostDetailsResponseDto> {
    return this.postsService.updatePost(
      Number(postId),
      updatePostDto,
      images,
      user.id,
    );
  }

  @Delete(':post_id')
  async deletePost(@Param('post_id') postId: number) {
    return this.postsService.deletePost(Number(postId));
  }

  @Get('search')
  async searchPosts(
    @Query('q') query: string,
    @Query('page') page: string = '1', // using string here because somehow default value is not working with number
    @Query('page_size') page_size: string = '25',
  ): Promise<PostListItemResponseDto[]> {
    return this.postsService.searchPosts(
      query,
      Number(page),
      Number(page_size),
    );
  }

  @Post('for-you')
  async getForYouPosts(
    @Body() body: { page: number; page_size: number; filter: string[] },
    @CurrentUser() user: CurrentUserType,
  ): Promise<PostListItemResponseDto[]> {
    const { page = 1, page_size = 25, filter } = body;

    return this.postsService.getForYouPosts(
      user.id,
      page,
      page_size,
      filter,
    );
  }

  @Post('following')
  async getFollowingPosts(
    @Body() body: { page: number; page_size: number; filter: string[] },
    @CurrentUser() user: CurrentUserType,
  ): Promise<PostListItemResponseDto[]> {
    const { page = 1, page_size = 24, filter } = body;

    return this.postsService.getFollowingPosts(
      user.id,
      page,
      page_size,
      filter,
    );
  }

  @Get(':post_id')
  async getPostDetails(
    @Param('post_id') postId: number,
  ): Promise<PostDetailsResponseDto> {
    return this.postsService.getPostDetails(Number(postId));
  }

  @Get('user/:username')
  async findPostsByUsername(
    @Param('username') username: string,
    @Query('page') page: string = '1',
    @Query('page_size') pageSize: string = '25',
  ): Promise<PostListItemResponseDto[]> {
    return this.postsService.findPostsByUsername(
      username,
      Number(page),
      Number(pageSize),
    );
  }
}
