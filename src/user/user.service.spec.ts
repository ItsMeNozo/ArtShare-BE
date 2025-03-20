// src/user/user.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { User } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { UpdateUserDTO } from './dto/update-user.dto'; // Import UpdateUserDTO if it is being used
import { DeleteUsersDTO } from './dto/delete-users.dto';
import { PrismaService } from '../prisma.service';

describe('UserService', () => {
  let service: UserService;
  let prismaService: PrismaService; // or  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        // Provide a mock for PrismaService
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              deleteMany: jest.fn(),
              delete: jest.fn(),
            },
            follow: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService); // Get a reference to the mock
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  //Example test case
  it('should create a user', async () => {
    const userData = {
      email: 'test@example.com',
      password_hash: 'hashed_password',
      username: 'testuser',
    };
    const createdUser: User = {
      id: 1,
      ...userData,
      full_name: null,
      profile_picture_url: null,
      bio: null,
      created_at: new Date(),
      updated_at: null,
      refresh_token: null,
    };

    (prismaService.user.create as jest.Mock).mockResolvedValue(createdUser); // Mock the Prisma method

    expect(await service.createUser(userData)).toEqual(createdUser);
    expect(prismaService.user.create).toHaveBeenCalledWith({ data: userData });
  });

  it('should find a user by email', async () => {
    const email = 'test@example.com';
    const mockUser: User = {
      id: 1,
      email,
      username: 'testuser',
      password_hash: 'hashed_password',
      full_name: 'Test User',
      profile_picture_url: null,
      bio: null,
      created_at: new Date(),
      updated_at: null,
      refresh_token: null,
    };

    (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    const foundUser = await service.findUserByEmail(email);
    expect(foundUser).toEqual(mockUser);
    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { email },
    });
  });
  it('should get a user profile', async () => {
    const userId = 1;
    const mockUser = {
      username: 'testuser',
      email: 'test@example.com',
      full_name: 'Test User',
      profile_picture_url: 'http://example.com/image.jpg',
      bio: 'Test Bio',
    };
    (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const userProfile = await service.getUserProfile(userId);
    expect(userProfile).toEqual(mockUser);
    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        full_name: true,
        profile_picture_url: true,
        bio: true,
      },
    });
  });

  it('should throw NotFoundException when updating a non-existent user', async () => {
    const userId = 999; // Non-existent ID
    const updateUserDto: UpdateUserDTO = {
      full_name: 'Updated Name',
      bio: 'Updated Bio',
    };

    // Mock the Prisma update method to reject with a specific error code.
    (prismaService.user.update as jest.Mock).mockRejectedValue({
      code: 'P2025',
    });
    await expect(
      service.updateUserProfile(userId, updateUserDto),
    ).rejects.toThrow(NotFoundException);
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: updateUserDto,
      select: {
        username: true,
        email: true,
        full_name: true,
        profile_picture_url: true,
        bio: true,
      },
    });
  });
  it('should find all users', async () => {
    const mockUsers: User[] = [
      {
        id: 1,
        email: 'test1@example.com',
        username: 'testuser1',
        password_hash: 'hash1',
        full_name: 'Test User 1',
        profile_picture_url: null,
        bio: null,
        created_at: new Date(),
        updated_at: null,
        refresh_token: null,
      },
      {
        id: 2,
        email: 'test2@example.com',
        username: 'testuser2',
        password_hash: 'hash2',
        full_name: 'Test User 2',
        profile_picture_url: null,
        bio: null,
        created_at: new Date(),
        updated_at: null,
        refresh_token: null,
      },
    ];
    (prismaService.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

    const users = await service.findAll();
    expect(users).toEqual(mockUsers);
    expect(prismaService.user.findMany).toHaveBeenCalled();
  });
  it('should update a user', async () => {
    const userId = 1;
    const updateData: Partial<User> = { full_name: 'Updated Name' };
    const updatedUser: User = {
      id: userId,
      email: 'test@example.com',
      username: 'testuser',
      password_hash: 'hashed',
      full_name: 'Updated Name',
      profile_picture_url: null,
      bio: null,
      created_at: new Date(),
      updated_at: new Date(),
      refresh_token: null,
    };

    (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

    expect(await service.updateUser(userId, updateData)).toEqual(updatedUser);
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: updateData,
    });
  });

  it('should delete multiple users', async () => {
    const deleteUserDTO: DeleteUsersDTO = { userIds: [1, 2] };
    const mockDeleteResult = { count: 2 };

    (prismaService.user.deleteMany as jest.Mock).mockResolvedValue(
      mockDeleteResult,
    );

    expect(await service.deleteUsers(deleteUserDTO)).toEqual(mockDeleteResult);
    expect(prismaService.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: deleteUserDTO.userIds } },
    });
  });

  it('should delete a user by ID', async () => {
    const userId = 1;
    const mockDeleteResult = { count: 1 }; // Or whatever your delete method returns

    (prismaService.user.delete as jest.Mock).mockResolvedValue(
      mockDeleteResult,
    );

    expect(await service.deleteUserById(userId)).toEqual(mockDeleteResult);
    expect(prismaService.user.delete).toHaveBeenCalledWith({
      where: { id: userId },
    });
  });

  it('should follow a user', async () => {
    const followerId = 1;
    const followingId = 2;

    // Mock findUnique calls for follower and following users.
    (prismaService.user.findUnique as jest.Mock).mockImplementation(
      ({ where }) => {
        if (where.id === followerId || where.id === followingId) {
          return Promise.resolve({ id: where.id }); // Return a mock user
        }
        return Promise.resolve(null); // Or null if needed for other IDs.
      },
    );

    (prismaService.follow.findUnique as jest.Mock).mockResolvedValue(null); // Not already following
    (prismaService.follow.create as jest.Mock).mockResolvedValue(undefined); // Mock successful creation

    const result = await service.followUser(followerId, followingId);
    expect(result).toBe('Followed successfully.');
    expect(prismaService.follow.create).toHaveBeenCalledWith({
      data: { follower_id: followerId, following_id: followingId },
    });
  });

  it('should return "Already following." if already following', async () => {
    const followerId = 1;
    const followingId = 2;

    // Mock findUnique calls for follower and following users.
    (prismaService.user.findUnique as jest.Mock).mockImplementation(
      ({ where }) => {
        if (where.id === followerId || where.id === followingId) {
          return Promise.resolve({ id: where.id }); // Return a mock user
        }
        return Promise.resolve(null); // Or null if needed for other IDs.
      },
    );

    (prismaService.follow.findUnique as jest.Mock).mockResolvedValue({}); // Simulate already following

    const result = await service.followUser(followerId, followingId);
    expect(result).toBe('Already following.');
    expect(prismaService.follow.create).not.toHaveBeenCalled();
  });

  it('should return "User not found" if follower or following user does not exist', async () => {
    const followerId = 1;
    const followingId = 999; // Non-existent user

    // Mock findUnique calls for follower and following users.
    (prismaService.user.findUnique as jest.Mock).mockImplementation(
      ({ where }) => {
        if (where.id === followerId) {
          return Promise.resolve({ id: where.id }); // Return a mock user
        }
        return Promise.resolve(null); // Or null if needed for other IDs.
      },
    );

    const result = await service.followUser(followerId, followingId);
    expect(result).toBe('User not found');
    expect(prismaService.follow.create).not.toHaveBeenCalled();
  });
  it('should throw an error when trying to follow self', async () => {
    const userId = 1;
    await expect(service.followUser(userId, userId)).rejects.toThrow(
      'Cannot follow yourself.',
    );
  });
  it('should unfollow a user', async () => {
    const followerId = 1;
    const followingId = 2;

    (prismaService.follow.findUnique as jest.Mock).mockResolvedValue({}); // Simulate following
    (prismaService.follow.delete as jest.Mock).mockResolvedValue(undefined); // Mock successful deletion

    const result = await service.unfollowUser(followerId, followingId);
    expect(result).toBe('Unfollowed successfully.');
    expect(prismaService.follow.delete).toHaveBeenCalledWith({
      where: {
        follower_id_following_id: {
          follower_id: followerId,
          following_id: followingId,
        },
      },
    });
  });

  it('should return "Not following" if not already following', async () => {
    const followerId = 1;
    const followingId = 2;

    (prismaService.follow.findUnique as jest.Mock).mockResolvedValue(null); // Simulate not following

    const result = await service.unfollowUser(followerId, followingId);
    expect(result).toBe('Not following');
    expect(prismaService.follow.delete).not.toHaveBeenCalled();
  });
});
