import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { FirebaseError } from 'firebase-admin';
import { Auth } from 'firebase-admin/auth';
import { Role } from 'src/auth/enums/role.enum';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Prisma, User, UserAccess } from 'src/generated';
import { PrismaService } from '../prisma.service';
import { CreateUserAdminDTO } from './dto/create-user-admin.dto';
import { DeleteUsersDTO } from './dto/delete-users.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { UpdateUserAdminDTO } from './dto/update-user-admin.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserAdminService {
  private readonly logger = new Logger(UserAdminService.name);

  constructor(
    private prisma: PrismaService,
    private readonly firebaseAuth: Auth,
  ) {}

  private mapUserToUserResponseDto(
    userWithRelations: User & {
      roles: Array<{ role: { roleName: string } }>;
      userAccess: UserAccess | null;
    },
  ): UserResponseDto {
    return {
      id: userWithRelations.id,
      email: userWithRelations.email,
      username: userWithRelations.username,
      fullName: userWithRelations.fullName,
      profilePictureUrl: userWithRelations.profilePictureUrl,
      bio: userWithRelations.bio,
      createdAt: userWithRelations.createdAt,
      updatedAt: userWithRelations.updatedAt,
      birthday: userWithRelations.birthday,
      followersCount: userWithRelations.followersCount,
      followingsCount: userWithRelations.followingsCount,
      roles: userWithRelations.roles.map((ur) => ur.role.roleName as Role),
      status: userWithRelations.status,
      userAccess: userWithRelations.userAccess,
    };
  }

  async findAllWithDetailsPaginated(
    query: PaginationQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      filter,
    } = query;

    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {};

    if (search) {
      whereClause.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filter) {
      const { roles, status } = filter;

      if (roles) {
        whereClause.roles = {
          some: {
            role: {
              roleName: { in: roles },
            },
          },
        };
      }
      if (status) {
        whereClause.status = status;
      }
    }

    const users = await this.prisma.user.findMany({
      skip,
      take: limit,
      where: whereClause,
      include: {
        roles: { include: { role: true } },
        userAccess: true,
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    const totalUsers = await this.prisma.user.count({
      where: whereClause,
    });

    const mappedUsers = users
      .map((user) => this.mapUserToUserResponseDto(user as any))
      .filter((dto) => dto !== null) as UserResponseDto[];

    return {
      data: mappedUsers,
      total: totalUsers,
      page: Number(page),
      limit: Number(limit),
    };
  }

  async findAllWithDetails(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      include: {
        roles: { include: { role: true } },
        userAccess: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return users
      .map((user) => this.mapUserToUserResponseDto(user))
      .filter((dto) => dto !== null) as UserResponseDto[];
  }

  async findOneByIdWithDetails(
    userId: string,
  ): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        userAccess: true,
      },
    });

    if (!user) {
      return null;
    }
    return this.mapUserToUserResponseDto(user);
  }

  async createUserByAdmin(dto: CreateUserAdminDTO): Promise<UserResponseDto> {
    const {
      id,
      username,
      email,
      fullName,
      profilePictureUrl,
      bio,
      birthday,
      roles: roleNames,
      status,
    } = dto;

    const existingUserById = await this.prisma.user.findUnique({
      where: { id },
    });
    if (existingUserById) {
      throw new ConflictException(
        `User with ID (Firebase UID) '${id}' already exists locally.`,
      );
    }

    const [existingUserByEmail, existingUserByUsername] = await Promise.all([
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.user.findUnique({ where: { username } }),
    ]);
    if (existingUserByEmail)
      throw new ConflictException(`Email '${email}' is already in use.`);
    if (existingUserByUsername)
      throw new ConflictException(`Username '${username}' is already in use.`);

    const dbRoles = await this.prisma.role.findMany({
      where: { roleName: { in: roleNames } },
    });
    if (dbRoles.length !== roleNames.length) {
      const foundDbRoleNames = dbRoles.map((r) => r.roleName);
      const missingRoles = roleNames.filter(
        (rName) => !foundDbRoleNames.includes(rName),
      );
      throw new BadRequestException(
        `Invalid roles: ${missingRoles.join(', ')}. Roles do not exist.`,
      );
    }

    try {
      const newUser = await this.prisma.user.create({
        data: {
          id,
          username,
          email,
          fullName: fullName || null,
          profilePictureUrl: profilePictureUrl || null,
          bio: bio || null,
          birthday: birthday ? new Date(birthday) : null,
          status: status,
          roles: {
            create: dbRoles.map((role) => ({
              roleId: role.roleId,
              assignedAt: new Date(),
            })),
          },
        },
        include: {
          roles: { include: { role: true } },
          userAccess: true,
        },
      });
      const mappedUser = this.mapUserToUserResponseDto(newUser);

      return mappedUser;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target =
          (error.meta?.target as string[])?.join(', ') || 'a unique field';
        throw new ConflictException(
          `A user with this ${target} already exists.`,
        );
      }
      this.logger.error('Error creating user by admin:', error);
      throw new InternalServerErrorException('Could not create user.');
    }
  }

  async updateUserByAdmin(
    userId: string,
    dto: UpdateUserAdminDTO,
    newProfilePictureUrlFromStorage?: string | null,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`Attempted to update non-existent user: ${userId}`);
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    if (dto.email && dto.email !== user.email) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingByEmail && existingByEmail.id !== userId) {
        throw new ConflictException(`Email '${dto.email}' is already in use.`);
      }
    }
    if (dto.username && dto.username !== user.username) {
      const existingByUsername = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existingByUsername && existingByUsername.id !== userId) {
        throw new ConflictException(
          `Username '${dto.username}' is already in use.`,
        );
      }
    }

    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (dto.username !== undefined) dataToUpdate.username = dto.username;
    if (dto.email !== undefined) dataToUpdate.email = dto.email;
    if (dto.fullName !== undefined) dataToUpdate.fullName = dto.fullName;
    if (dto.bio !== undefined) dataToUpdate.bio = dto.bio;
    if (dto.status !== undefined) dataToUpdate.status = dto.status;
    if (dto.birthday !== undefined) {
      if (dto.birthday === null || dto.birthday === '') {
        dataToUpdate.birthday = null;
      } else {
        const dateObj = new Date(dto.birthday);
        if (isNaN(dateObj.getTime())) {
          throw new BadRequestException(
            `Invalid date format for birthday: "${dto.birthday}". Please use YYYY-MM-DD.`,
          );
        }
        dataToUpdate.birthday = dateObj;
      }
    }
    if (newProfilePictureUrlFromStorage !== undefined) {
      dataToUpdate.profilePictureUrl = newProfilePictureUrlFromStorage;
    }

    if (dto.roles) {
      const dbRoles = await this.prisma.role.findMany({
        where: { roleName: { in: dto.roles as string[] } },
      });

      if (dbRoles.length !== dto.roles.length) {
        const foundDbRoleNames = dbRoles.map((r) => r.roleName);
        const missingRoles = dto.roles.filter(
          (rName) => !foundDbRoleNames.includes(rName),
        );
        throw new BadRequestException(
          `Invalid roles provided for update: ${missingRoles.join(', ')}. Ensure roles exist.`,
        );
      }

      dataToUpdate.roles = {
        deleteMany: {},
        create: dbRoles.map((role) => ({
          roleId: role.roleId,
          assignedAt: new Date(),
        })),
      };
    }

    if (
      Object.keys(dataToUpdate).length === 0 &&
      !dto.roles &&
      newProfilePictureUrlFromStorage === undefined
    ) {
      this.logger.log(
        `Update request for user ${userId} with no actual changes.`,
      );

      const currentUserData = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } }, userAccess: true },
      });
      if (!currentUserData)
        throw new NotFoundException(`User with ID ${userId} not found.`);
      return this.mapUserToUserResponseDto(currentUserData);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
        include: {
          roles: { include: { role: true } },
          userAccess: true,
        },
      });
      return this.mapUserToUserResponseDto(updatedUser);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target =
          (error.meta?.target as string[])?.join(', ') || 'a unique field';
        throw new ConflictException(
          `A user with this ${target} already exists (possibly due to a race condition).`,
        );
      }
      this.logger.error(`Error updating user ${userId} by admin:`, error);
      throw new InternalServerErrorException(
        'Could not update user information.',
      );
    }
  }

  async getUserForUpdate(
    userId: string,
  ): Promise<{ id: string; profilePictureUrl: string | null } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profilePictureUrl: true },
    });
    if (!user) return null;
    return { id: user.id, profilePictureUrl: user.profilePictureUrl };
  }

async deleteUserById(userId: string): Promise<{
  message: string;
  firebaseDeleted: boolean;
  dbDeleted: boolean;
}> {
  let firebaseUserFoundAndDeleted = false;
  let dbUserFoundAndDeleted = false;

  // 1. Delete from Firebase
  try {
    await this.firebaseAuth.deleteUser(userId);
    firebaseUserFoundAndDeleted = true;
    this.logger.log(`User ${userId} successfully deleted from Firebase.`);
  } catch (error: any) {
    const firebaseError = error as FirebaseError;
    if (firebaseError.code === 'auth/user-not-found') {
      this.logger.warn(
        `User ${userId} not found in Firebase, proceeding with DB deletion.`,
      );
    } else {
      this.logger.error(
        `Failed to delete user ${userId} from Firebase:`,
        firebaseError.message,
      );
      throw new InternalServerErrorException(
        `Firebase deletion failed: ${firebaseError.message}`,
      );
    }
  }

  // 2. Delete from Database with proper counter updates and error handling
  try {
    await this.prisma.$transaction(async (tx) => {
      // Fetch all relationships that need counter updates
      const [
        followers, 
        followings, 
        userComments, 
        userLikes, 
        userCommentLikes
      ] = await Promise.all([
        tx.follow.findMany({ where: { followingId: userId } }),
        tx.follow.findMany({ where: { followerId: userId } }),
        tx.comment.findMany({ where: { userId } }),
        tx.like.findMany({ where: { userId } }),
        tx.commentLike.findMany({ where: { userId } })
      ]);

      // Update follower counts
      const followerIds = followers.map(f => f.followerId);
      if (followerIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: followerIds } },
          data: { followingsCount: { decrement: 1 } },
        });
      }

      // Update following counts
      const followingIds = followings.map(f => f.followingId);
      if (followingIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: followingIds } },
          data: { followersCount: { decrement: 1 } },
        });
      }

      // Update comment counts for posts (with error handling for missing posts)
      const postCommentMap: Record<number, number> = {};
      userComments.forEach(comment => {
        if (comment.targetType === 'POST' && comment.targetId) {
          postCommentMap[comment.targetId] = (postCommentMap[comment.targetId] || 0) + 1;
        }
      });
      
      const postIds = Object.keys(postCommentMap);
      let updatedPosts = 0;
      if (postIds.length > 0) {
        for (const postId of postIds) {
          try {
            await tx.post.update({
              where: { id: Number(postId) },
              data: { commentCount: { decrement: postCommentMap[Number(postId)] } },
            });
            updatedPosts++;
          } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
              this.logger.warn(`Post ${postId} not found - skipping comment count update`);
            } else {
              throw error;
            }
          }
        }
        this.logger.log(`Updated comment counts for ${updatedPosts}/${postIds.length} post(s)`);
      }

      // Update comment counts for blogs (with error handling for missing blogs)
      const blogCommentMap: Record<number, number> = {};
      userComments.forEach(comment => {
        if (comment.targetType === 'BLOG' && comment.targetId) {
          blogCommentMap[comment.targetId] = (blogCommentMap[comment.targetId] || 0) + 1;
        }
      });
      
      const blogIds = Object.keys(blogCommentMap);
      let updatedBlogs = 0;
      if (blogIds.length > 0) {
        for (const blogId of blogIds) {
          try {
            await tx.blog.update({
              where: { id: Number(blogId) },
              data: { commentCount: { decrement: blogCommentMap[Number(blogId)] } },
            });
            updatedBlogs++;
          } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
              this.logger.warn(`Blog ${blogId} not found - skipping comment count update`);
            } else {
              throw error;
            }
          }
        }
        this.logger.log(`Updated comment counts for ${updatedBlogs}/${blogIds.length} blog(s)`);
      }

      // Update like counts for posts (with error handling)
      const likedPostIds = userLikes
        .filter(like => like.postId !== null)
        .map(like => like.postId!);
      
      if (likedPostIds.length > 0) {
        try {
          const result = await tx.post.updateMany({
            where: { id: { in: likedPostIds } },
            data: { likeCount: { decrement: 1 } },
          });
          this.logger.log(`Decremented like counts for ${result.count}/${likedPostIds.length} post(s)`);
        } catch (error: any) {
          this.logger.warn(`Error updating post like counts - some posts may have been deleted: ${error.message}`);
        }
      }

      // Update like counts for blogs (with error handling)
      const likedBlogIds = userLikes
        .filter(like => like.blogId !== null)
        .map(like => like.blogId!);
      
      if (likedBlogIds.length > 0) {
        try {
          const result = await tx.blog.updateMany({
            where: { id: { in: likedBlogIds } },
            data: { likeCount: { decrement: 1 } },
          });
          this.logger.log(`Decremented like counts for ${result.count}/${likedBlogIds.length} blog(s)`);
        } catch (error: any) {
          this.logger.warn(`Error updating blog like counts - some blogs may have been deleted: ${error.message}`);
        }
      }

      // Update like counts for comments (with error handling)
      const likedCommentIds = userCommentLikes.map(like => like.commentId);
      if (likedCommentIds.length > 0) {
        try {
          const result = await tx.comment.updateMany({
            where: { id: { in: likedCommentIds } },
            data: { likeCount: { decrement: 1 } },
          });
          this.logger.log(`Decremented like counts for ${result.count}/${likedCommentIds.length} comment(s)`);
        } catch (error: any) {
          this.logger.warn(`Error updating comment like counts - some comments may have been deleted: ${error.message}`);
        }
      }

      // Handle non-cascading relationships (with error handling)
      try {
        const [updatedReports, deletedConversations] = await Promise.all([
          // Set moderatorId to null for reports where user was moderator
          tx.report.updateMany({
            where: { moderatorId: userId },
            data: { moderatorId: null }
          }),
          
          // Delete conversations (these don't cascade in your schema)
          tx.conversation.deleteMany({ where: { userId } })
        ]);

        if (updatedReports.count > 0) {
          this.logger.log(`Updated ${updatedReports.count} report(s) - removed moderator assignment`);
        }
        
        if (deletedConversations.count > 0) {
          this.logger.log(`Deleted ${deletedConversations.count} conversation(s)`);
        }
      } catch (error: any) {
        this.logger.warn(`Error handling non-cascading relationships: ${error.message}`);
      }

      // Finally, delete the user (this will cascade delete most relationships)
      await tx.user.delete({ where: { id: userId } });
    }, {
      timeout: 30000, // 30 seconds timeout for large datasets
      maxWait: 35000, // Max wait time
    });
    
    dbUserFoundAndDeleted = true;
    this.logger.log(`User ${userId} successfully deleted from the database.`);
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      this.logger.warn(
        `User ${userId} not found in the database, but corresponding Firebase user (if existed) was deleted.`,
      );
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      this.logger.error(
        `Unique constraint violation while deleting user ${userId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Database deletion failed due to unique constraint violation. Manual cleanup may be required.',
      );
    } else if (error.message.includes('Foreign key constraint failed')) {
      this.logger.error(
        `Foreign key constraint failed while deleting user ${userId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Database deletion failed due to foreign key constraint. Manual cleanup may be required.',
      );
    } else if (error.message.includes('Transaction already closed') || error.message.includes('timeout')) {
      this.logger.error(
        `Transaction timeout while deleting user ${userId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Database deletion failed due to timeout. User has too much data. Manual cleanup may be required.',
      );
    } else if (error.message.includes('Record to update not found')) {
      this.logger.error(
        `Some records referenced by user ${userId} no longer exist (data integrity issue):`,
        error,
      );
      throw new InternalServerErrorException(
        'Database deletion failed due to data integrity issues. Manual cleanup may be required.',
      );
    } else {
      this.logger.error(
        `Database deletion for user ${userId} failed after Firebase deletion:`,
        error,
      );
      throw new InternalServerErrorException(
        'Database deletion failed after successful Firebase deletion. Manual cleanup may be required.',
      );
    }
  }

  // Generate appropriate response message
  let message = 'User processed.';
  if (firebaseUserFoundAndDeleted && dbUserFoundAndDeleted) {
    message = `User ${userId} was successfully deleted from both Firebase and the database.`;
  } else if (firebaseUserFoundAndDeleted) {
    message = `User ${userId} was deleted from Firebase, but was not found in the database.`;
  } else if (dbUserFoundAndDeleted) {
    message = `User ${userId} was deleted from the database, but was not found in Firebase.`;
  } else {
    message = `User ${userId} was not found in either Firebase or the database.`;
  }

  return {
    message,
    firebaseDeleted: firebaseUserFoundAndDeleted,
    dbDeleted: dbUserFoundAndDeleted,
  };
}

  async deleteUsers(deleteUsersDto: DeleteUsersDTO): Promise<any> {
    const { userIds } = deleteUsersDto;

    const results = [];
    for (const userId of userIds) {
      try {
        const result = await this.deleteUserById(userId);
        results.push({ userId, status: 'success', details: result.message });
      } catch (error: any) {
        this.logger.error(`Failed to delete user ${userId}:`, error.message);
        results.push({ userId, status: 'error', details: error.message });
      }
    }

    return results;
  }
}
