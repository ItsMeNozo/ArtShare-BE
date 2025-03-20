import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Req,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '@prisma/client';
import { UserProfileDTO } from './dto/user-profile.dto';
import { UpdateUserDTO } from './dto/update-user.dto';
import { DeleteUsersDTO } from './dto/delete-users.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(): Promise<User[] | null> {
    return this.userService.findAll();
  }

  @Get('profile')
  async getProfile(): Promise<UserProfileDTO> {
    // const userId = req.user.id;
    // hiện tại fix cứng, chưa có implement token
    const userId = 10;
    return this.userService.getUserProfile(userId);
  }

  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() updateUserDto: UpdateUserDTO) {
    const userId = req.user?.id | 10;
    return this.userService.updateUserProfile(userId, updateUserDto);
  }

  @Post('create')
  async create(
    @Body()
    createUserDto: {
      email: string;
      password_hash: string;
      username: string;
    },
  ): Promise<User> {
    return this.userService.createUser(createUserDto);
  }

  // Cập nhật thông tin người dùng
  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body()
    updateUserDto: {
      full_name?: string;
      bio?: string;
      profile_picture_url?: string;
    },
  ): Promise<User> {
    return this.userService.updateUser(id, updateUserDto);
  }

  // Xoá nhiều người dùng
  @Delete()
  async deleteUsers(@Body() deleteUsersDTO: DeleteUsersDTO): Promise<any> {
    return this.userService.deleteUsers(deleteUsersDTO);
  }

  // Xoá người dùng bằng userId
  @Delete(':userId')
  async deleteUserById(@Param('userId') userId: number): Promise<any> {
    return this.userService.deleteUserById(userId);
  }

  @Post(':userId/follow')
  async followUser(
    @Param('userId', ParseIntPipe) userIdToFollow: number,
  ): Promise<string> {
    // const currentUserId = req.user.id; Lấy thông tin user từ token
    // hiện tại fix cứng, chưa có implement token
    const currentUserId = 10;

    return this.userService.followUser(currentUserId, userIdToFollow);
  }

  @Post(':userId/unfollow')
  async unfollowUser(
    @Param('userId', ParseIntPipe) userIdToUnfollow: number,
  ): Promise<string> {
    const currentUserId = 10;

    return this.userService.unfollowUser(currentUserId, userIdToUnfollow);
  }
}
