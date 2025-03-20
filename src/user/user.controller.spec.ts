// src/user/user.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DeleteUsersDTO } from './dto/delete-users.dto';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>; // Use jest.Mocked

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            // Mock the entire UserService
            getUserProfile: jest.fn(),
            updateUserProfile: jest.fn(),
            findAll: jest.fn(),
            updateUser: jest.fn(),
            deleteUsers: jest.fn(),
            deleteUserById: jest.fn(),
            followUser: jest.fn(),
            unfollowUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(
      UserService,
    ) as jest.Mocked<UserService>; // Get mocked service
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delete users', async () => {
    const deleteUsersDto: DeleteUsersDTO = { userIds: [1, 2] };
    const mockDeleteResult = { count: 2 };

    userService.deleteUsers.mockResolvedValue(mockDeleteResult);

    expect(await controller.deleteUsers(deleteUsersDto)).toEqual(
      mockDeleteResult,
    );
    expect(userService.deleteUsers).toHaveBeenCalledWith(deleteUsersDto);
  });
});
