import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import {
  FollowUserResponseDto,
  UnfollowUserResponseDto,
} from 'src/common/dto/api-response.dto';
import { UpdateUserDTO } from './dto/update-users.dto';
import { UserProfileDTO } from './dto/user-profile.dto';
import { UserService } from './user.service';

import { Public } from 'src/auth/decorators/public.decorator';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { FollowerDto } from './dto/follower.dto';
import { UserProfileMeDTO } from './dto/get-user-me.dto';
import { PublicUserSearchResponseDto } from './dto/response/search-users.dto';
import { UserReadService } from './user-read.service';
import { UserFollowService } from './user.follow.service';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userFollowService: UserFollowService,
    private readonly userReadService: UserReadService,
  ) {}

  @Get('search')
  @Public()
  async searchUsers(
    @Query() paginationQuery: PaginationQueryDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<PaginatedResponse<PublicUserSearchResponseDto>> {
    return this.userReadService.searchUsers(paginationQuery, user?.id);
  }

  @Get('profile/:userId')
  @HttpCode(HttpStatus.OK)
  async getPublicUserProfile(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<UserProfileDTO> {
    return this.userService.getUserProfile(userId, currentUser);
  }

  @Get('profile/username/:username')
  @HttpCode(HttpStatus.OK)
  async getPublicUserProfileByUsername(
    @Param('username') username: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<UserProfileDTO> {
    return this.userService.getUserProfileByUsername(username, currentUser);
  }

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getCurrentUserProfile(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<UserProfileMeDTO> {
    return this.userService.getUserProfileForMe(currentUser);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current logged-in user profile' })
  @ApiBody({ type: UpdateUserDTO })
  async updateCurrentUserProfile(
    @CurrentUser() currentUser: CurrentUserType,
    @Body() updateUserDto: UpdateUserDTO,
  ) {
    return this.userService.updateUserProfile(currentUser.id, updateUserDto);
  }

  @Post(':userIdToFollow/follow')
  @HttpCode(HttpStatus.CREATED)
  async followUser(
    @Param('userIdToFollow') userIdToFollow: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<FollowUserResponseDto> {
    if (userIdToFollow === currentUser.id) {
      throw new BadRequestException('You cannot follow yourself.');
    }
    return this.userFollowService.followUser(currentUser.id, userIdToFollow);
  }

  @Post(':userIdToUnfollow/unfollow')
  @HttpCode(HttpStatus.OK)
  async unfollowUser(
    @Param('userIdToUnfollow') userIdToUnfollow: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<UnfollowUserResponseDto> {
    if (userIdToUnfollow === currentUser.id) {
      throw new BadRequestException('You cannot unfollow yourself.');
    }
    return this.userFollowService.unfollowUser(
      currentUser.id,
      userIdToUnfollow,
    );
  }

  @Get(':userId/followers')
  @HttpCode(HttpStatus.OK)
  async getFollowersList(
    @Param('userId') userId: string,
  ): Promise<FollowerDto[]> {
    return this.userFollowService.getFollowersListByUserId(userId);
  }

  @Get(':userId/followings')
  @HttpCode(HttpStatus.OK)
  async getFollowingsList(
    @Param('userId') userId: string,
  ): Promise<FollowerDto[]> {
    return this.userFollowService.getFollowingsListByUserId(userId);
  }
}
