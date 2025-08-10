import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Public } from 'src/auth/decorators/public.decorator';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { SyncEmbeddingResponseDto } from 'src/common/response/sync-embedding.dto';
import { TargetType } from 'src/generated';
import { LikingUserResponseDto } from 'src/likes/dto/response/liking-user-response.dto';
import { LikesService } from 'src/likes/likes.service';
import { CreatePostRequestDto } from './dto/request/create-post.dto';
import { GetPostsDto } from './dto/request/get-posts.dto';
import { PatchThumbnailDto } from './dto/request/patch-thumbnail.dto';
import { SearchPostDto } from './dto/request/search-post.dto';
import { UpdatePostDto } from './dto/request/update-post.dto';
import { GeneratePostMetadataResponseDto } from './dto/response/generate-post-metadata.dto';
import { PostDetailsResponseDto } from './dto/response/post-details.dto';
import { PostListItemResponse } from './dto/response/post-list-item.dto';
import { AdminPostListItemDto, PostsAdminService } from './posts-admin.service';
import { PostsEmbeddingService } from './posts-embedding.service';
import { PostsExploreService } from './posts-explore.service';
import { PostsManagementService } from './posts-management.service';
import { WorkflowAssistService } from './workflow-assist.service';
import { PostDetailForViewDto } from './dto/response/post-details-view.dto';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
    private readonly postsManagementService: PostsManagementService,
    private readonly postsExploreService: PostsExploreService,
    private readonly workflowAssistService: WorkflowAssistService,
    private readonly postsEmbeddingService: PostsEmbeddingService,
    private readonly likesService: LikesService,
    private readonly postsAdminService: PostsAdminService,
  ) {}

  @Post()
  @UseInterceptors(FilesInterceptor('images'))
  async createPost(
    @Body() request: CreatePostRequestDto,
    @UploadedFiles() images: Express.Multer.File[],
    @CurrentUser() user: CurrentUserType,
  ): Promise<any> {
    return this.postsManagementService.createPost(request, images, user.id);
  }

  @Patch(':post_id')
  @UseInterceptors(FilesInterceptor('images'))
  async updatePost(
    @Param('post_id', ParseIntPipe) postId: number,
    @Body() updatePostDto: UpdatePostDto,
    @UploadedFiles() images: Express.Multer.File[],
    @CurrentUser() user: CurrentUserType,
  ): Promise<PostDetailsResponseDto> {
    return this.postsManagementService.updatePost(
      postId,
      updatePostDto,
      images,
      user.id,
    );
  }

  @Delete(':post_id')
  async deletePost(@Param('post_id', ParseIntPipe) postId: number) {
    return this.postsManagementService.deletePost(postId);
  }

  @Public()
  @Get('search')
  @Public()
  async searchPosts(
    @Query() query: SearchPostDto,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<PaginatedResponse<PostListItemResponse>> {
    return this.postsExploreService.searchPosts(query, user?.id ?? '');
  }

  @Public()
  @Get('for-you')
  async getForYouPosts(
    @Query() query: GetPostsDto,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<PaginatedResponse<PostListItemResponse>> {
    return this.postsExploreService.getForYouPosts(user?.id ?? '', query);
  }

  @Public()
  @Get('trending')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('posts-trending')
  @CacheTTL(60 * 1000) // 1 minutes
  async getTrendingPosts(
    @Query() query: GetPostsDto,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<PaginatedResponse<PostListItemResponse>> {
    return this.postsExploreService.getTrendingPosts(user?.id ?? '', query);
  }

  @Get('following')
  async getFollowingPosts(
    @Query() query: GetPostsDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<PaginatedResponse<PostListItemResponse>> {
    return this.postsExploreService.getFollowingPosts(user.id, query);
  }

  @Public()
  @Get('/ai-trending')
  async getAiTrendingPosts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('page_size', new DefaultValuePipe(25), ParseIntPipe)
    pageSize: number,
  ): Promise<PostListItemResponse[]> {
    return this.postsExploreService.getAiTrendingPosts(page, pageSize);
  }

  @Public()
  @Get(':post_id')
  async getPostDetails(
    @Param('post_id', ParseIntPipe) postId: number,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<PostDetailsResponseDto> {
    return this.postsExploreService.getPostDetails(postId, user?.id ?? '');
  }

  @Public()
  @Get(':post_id/view')
  async getPostDetailsForView(
    @Param('post_id', ParseIntPipe) postId: number,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<PostDetailForViewDto> {
    return this.postsExploreService.getPostDetailsForView(postId, user?.id ?? '');
  }

  @Public()
  @Get(':post_id/view')
  async getPostDetailsForView(
    @Param('post_id', ParseIntPipe) postId: number,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<PostDetailForViewDto> {
    return this.postsExploreService.getPostDetailsForView(postId, user?.id ?? '');
  }

  @Public()
  @Get('user/:username')
  async findPostsByUsername(
    @Param('username') username: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('page_size', new DefaultValuePipe(25), ParseIntPipe)
    pageSize: number,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<PostListItemResponse[]> {
    return this.postsExploreService.findPostsByUsername(
      username,
      page,
      pageSize,
      user?.id ?? '',
    );
  }

  @Patch(':id/thumbnail-crop')
  async patchThumbnailCropMeta(
    @Param('id', ParseIntPipe) postId: number,
    @Body() dto: PatchThumbnailDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.postsManagementService.updateThumbnailCropMeta(
      postId,
      dto,
      user.id,
    );
  }

  @Public()
  @Get(':post_id/relevant')
  async getRelevantPosts(
    @Param('post_id', ParseIntPipe) postId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(25), ParseIntPipe)
    pageSize: number,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<PostListItemResponse[]> {
    return this.postsExploreService.getRelevantPosts(
      postId,
      page,
      pageSize,
      user?.id ?? '',
    );
  }

  @Post('sync-embeddings')
  async syncPostsEmbedding(): Promise<SyncEmbeddingResponseDto> {
    return this.postsEmbeddingService.syncPostsEmbeddings();
  }

  @Post('generate-metadata')
  @UseInterceptors(FilesInterceptor('images'))
  @UseGuards(JwtAuthGuard)
  async generatePostMetadata(
    @UploadedFiles() images: Express.Multer.File[],
    @CurrentUser() user: CurrentUserType,
  ): Promise<GeneratePostMetadataResponseDto> {
    return this.workflowAssistService.generatePostMetadata(images, user.id);
  }

  /** GET /posts/:id/likes?skip=0&take=20 */
  @Public()
  @Get(':id/likes')
  async getPostLikes(
    @Param('id', ParseIntPipe) id: number,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
    @CurrentUser() user?: CurrentUserType,
  ): Promise<{ items: LikingUserResponseDto[]; total: number }> {
    return this.likesService.getLikingUsers(
      id,
      TargetType.POST,
      user?.id ?? null,
      skip,
      take,
    );
  }

  @Get('admin/all')
  @Roles(Role.ADMIN)
  async getAllPostsForAdmin(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    queryDto: PaginationQueryDto,
  ): Promise<PaginatedResponse<AdminPostListItemDto>> {
    return this.postsAdminService.getAllPostsForAdmin(queryDto);
  }

  @Patch('admin/:post_id')
  @Roles(Role.ADMIN)
  @UseInterceptors(FilesInterceptor('images'))
  async adminUpdatePost(
    @Param('post_id', ParseIntPipe) postId: number,
    @Body(ValidationPipe) updatePostDto: UpdatePostDto,
    @UploadedFiles() images: Express.Multer.File[],
    @CurrentUser() adminUser: CurrentUserType,
  ): Promise<PostDetailsResponseDto> {
    return this.postsAdminService.updatePostByAdmin(
      postId,
      updatePostDto,
      images,
      adminUser.id,
    );
  }

  @Delete('admin/bulk-delete')
  @Roles(Role.ADMIN)
  async bulkDeletePosts(
    @Body() body: { postIds: number[] },
    @CurrentUser() adminUser: CurrentUserType,
  ): Promise<{ count: number }> {
    return this.postsAdminService.bulkDeletePosts(body.postIds, adminUser.id);
  }

  @Delete('admin/:post_id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminDeletePost(
    @Param('post_id', ParseIntPipe) postId: number,
    @CurrentUser() adminUser: CurrentUserType,
  ): Promise<void> {
    await this.postsAdminService.deletePostByAdmin(postId, adminUser.id);
  }
}
