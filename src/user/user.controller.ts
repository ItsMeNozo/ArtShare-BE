import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '@prisma/client';
import { UserProfileDTO } from './dto/user-profile.dto';
import { DeleteUsersDTO } from './dto/delete-users.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { UpdateUserDTO } from './dto/update-users.dto';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { Role } from 'src/auth/enums/role.enum';
import { ApiResponse } from 'src/common/api-response';
import { ApiOperation } from '@nestjs/swagger';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(Role.ADMIN)
  async findAll(): Promise<User[] | null> {
    return this.userService.findAll();
  }

  @Get('profile/:userId')
  async getProfile(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<UserProfileDTO> {
    return this.userService.getUserProfile(userId, currentUser);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân của người dùng hiện tại' })
  async getUserProfile(
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return this.userService.getUserProfileForMe(currentUser);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân của người dùng hiện tại' })
  async updateProfile(
    @CurrentUser() currentUser: CurrentUserType,
    @Body() updateUserDto: UpdateUserDTO,
  ) {
    return this.userService.updateUserProfile(currentUser.id, updateUserDto);
  }

  // Xoá nhiều người dùng
  @Delete()
  async deleteUsers(@Body() deleteUsersDTO: DeleteUsersDTO): Promise<any> {
    return this.userService.deleteUsers(deleteUsersDTO);
  }

  // Xoá người dùng bằng userId
  @Delete(':userId')
  async deleteUserById(@Param('userId') userId: string): Promise<any> {
    return this.userService.deleteUserById(userId);
  }

  @Post(':userId/follow')
  async followUser(
    @Param('userId') userIdToFollow: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ApiResponse<any>> {
    return this.userService.followUser(currentUser.id, userIdToFollow);
  }

  @Post(':userId/unfollow')
  async unfollowUser(
    @Param('userId') userIdToUnfollow: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ApiResponse<any>> {
    return this.userService.unfollowUser(currentUser.id, userIdToUnfollow);
  }
}
