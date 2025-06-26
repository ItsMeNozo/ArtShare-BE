import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as admin from 'firebase-admin';
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
      roles: Array<{ role: { role_name: string } }>;
      userAccess: UserAccess | null;
    },
  ): UserResponseDto {
    return {
      id: userWithRelations.id,
      email: userWithRelations.email,
      username: userWithRelations.username,
      fullName: userWithRelations.full_name,
      profilePictureUrl: userWithRelations.profile_picture_url,
      bio: userWithRelations.bio,
      createdAt: userWithRelations.created_at,
      updatedAt: userWithRelations.updated_at,
      birthday: userWithRelations.birthday,
      followersCount: userWithRelations.followers_count,
      followingsCount: userWithRelations.followings_count,
      roles: userWithRelations.roles.map((ur) => ur.role.role_name as Role),
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
      sortBy = 'created_at',
      sortOrder = 'desc',
      search,
      filter,
    } = query;

    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { full_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filter) {
      const { roles, status } = filter;

      if (roles) {
        whereClause.roles = {
          some: {
            role: {
              role_name: { in: roles },
            },
          },
        };
      }
      if (status) {
        whereClause.status = status;
      }
    }

    let prismaSortBy = sortBy;
    if (sortBy === 'createdAt') {
      prismaSortBy = 'created_at';
    } else if (sortBy === 'updatedAt') {
      prismaSortBy = 'updated_at';
    } else if (sortBy === 'fullName') {
      prismaSortBy = 'full_name';
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
        [prismaSortBy]: sortOrder,
      },
    });

    const totalUsers = await this.prisma.user.count({
      where: whereClause,
    });

    const mappedUsers = users
      .map((user) => this.mapUserToUserResponseDto(user))
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
      orderBy: { created_at: 'desc' },
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
      where: { role_name: { in: roleNames } },
    });
    if (dbRoles.length !== roleNames.length) {
      const foundDbRoleNames = dbRoles.map((r) => r.role_name);
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
          full_name: fullName || null,
          profile_picture_url: profilePictureUrl || null,
          bio: bio || null,
          birthday: birthday ? new Date(birthday) : null,
          status: status,
          roles: {
            create: dbRoles.map((role) => ({
              role_id: role.role_id,
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
    if (dto.fullName !== undefined) dataToUpdate.full_name = dto.fullName;
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
      dataToUpdate.profile_picture_url = newProfilePictureUrlFromStorage;
    }

    if (dto.roles) {
      const dbRoles = await this.prisma.role.findMany({
        where: { role_name: { in: dto.roles as string[] } },
      });

      if (dbRoles.length !== dto.roles.length) {
        const foundDbRoleNames = dbRoles.map((r) => r.role_name);
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
          role_id: role.role_id,
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
      select: { id: true, profile_picture_url: true },
    });
    if (!user) return null;
    return { id: user.id, profilePictureUrl: user.profile_picture_url };
  }

  async deleteUserById(userId: string): Promise<{
    message: string;
    firebaseDeleted: boolean;
    dbDeleted: boolean;
  }> {
    let firebaseUserFoundAndDeleted = false;
    let dbUserFoundAndDeleted = false;

    try {
      await this.firebaseAuth.deleteUser(userId);
      firebaseUserFoundAndDeleted = true;
      this.logger.log(`User ${userId} successfully deleted from Firebase.`);
    } catch (error: any) {
      const firebaseError = error as FirebaseError;
      if (firebaseError.code === 'auth/user-not-found') {
        this.logger.warn(
          `User ${userId} not found in Firebase. Proceeding with DB deletion.`,
        );
      } else {
        this.logger.error(
          `Firebase error deleting user ${userId}: ${firebaseError.message}`,
          firebaseError.stack,
        );
        throw new InternalServerErrorException(
          `Failed to delete user ${userId} from Firebase: ${firebaseError.message}. DB deletion not attempted.`,
        );
      }
    }

    try {
      await this.prisma.user.delete({ where: { id: userId } });
      dbUserFoundAndDeleted = true;
      this.logger.log(`User ${userId} successfully deleted from Prisma DB.`);
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(`User ${userId} not found in Prisma DB (P2025).`);
      } else {
        this.logger.error(`Prisma error deleting user ${userId}:`, error);
        const firebaseMessage = firebaseUserFoundAndDeleted
          ? 'Firebase deletion succeeded.'
          : 'User not found in Firebase or Firebase deletion failed/skipped.';
        throw new InternalServerErrorException(
          `Failed to delete user ${userId} from Prisma DB. ${firebaseMessage} Prisma error: ${(error as Error).message}`,
        );
      }
    }

    if (firebaseUserFoundAndDeleted && dbUserFoundAndDeleted) {
      return {
        message: `User with ID ${userId} deleted successfully from Firebase and DB.`,
        firebaseDeleted: true,
        dbDeleted: true,
      };
    } else if (firebaseUserFoundAndDeleted && !dbUserFoundAndDeleted) {
      return {
        message: `User with ID ${userId} deleted from Firebase, but was not found/already deleted from DB.`,
        firebaseDeleted: true,
        dbDeleted: false,
      };
    } else if (!firebaseUserFoundAndDeleted && dbUserFoundAndDeleted) {
      return {
        message: `User with ID ${userId} deleted from DB, but was not found in Firebase.`,
        firebaseDeleted: false,
        dbDeleted: true,
      };
    } else {
      throw new NotFoundException(
        `User with ID ${userId} not found in Firebase and not found in DB.`,
      );
    }
  }

  async deleteMultipleUsers(deleteUsersDTO: DeleteUsersDTO): Promise<{
    message: string;
    firebase: {
      successCount: number;
      failureCount: number;
      errors: Array<{
        index: number;
        uid: string;
        reason: string;
        code?: string;
      }>;
    };
    prisma: { deletedCount: number; requestedCount: number };
  }> {
    const { userIds } = deleteUsersDTO;

    if (!userIds || userIds.length === 0) {
      return {
        message: 'No user IDs provided for deletion.',
        firebase: { successCount: 0, failureCount: 0, errors: [] },
        prisma: { deletedCount: 0, requestedCount: 0 },
      };
    }
    this.logger.log(
      `Attempting to delete ${userIds.length} users: [${userIds.join(', ')}]`,
    );

    let firebaseResult: admin.auth.DeleteUsersResult = {
      successCount: 0,
      failureCount: 0,
      errors: [],
    };
    const firebaseErrorsFormatted: Array<{
      index: number;
      uid: string;
      reason: string;
      code?: string;
    }> = [];

    if (userIds.length > 0) {
      try {
        firebaseResult = await this.firebaseAuth.deleteUsers(userIds);
        this.logger.log(
          `Firebase deleteUsers result: ${firebaseResult.successCount} successes, ${firebaseResult.failureCount} failures.`,
        );
        if (firebaseResult.failureCount > 0) {
          firebaseResult.errors.forEach((errorDetail) => {
            const failedUid = userIds[errorDetail.index];
            firebaseErrorsFormatted.push({
              index: errorDetail.index,
              uid: failedUid,
              reason: errorDetail.error.message,
              code: errorDetail.error.code,
            });
            this.logger.warn(
              `Failed to delete UID ${failedUid} from Firebase (index ${errorDetail.index}): ${errorDetail.error.code} - ${errorDetail.error.message}`,
            );
          });
        }
      } catch (error: any) {
        const firebaseError = error as FirebaseError;
        this.logger.error(
          `A general error occurred during Firebase deleteUsers: ${firebaseError.message}`,
          firebaseError.stack,
        );

        throw new InternalServerErrorException(
          `A general error occurred with Firebase while trying to delete multiple users. Error: ${firebaseError.message}. DB deletion not attempted.`,
        );
      }
    }

    let prismaDeletedCount = 0;
    try {
      const { count } = await this.prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
      prismaDeletedCount = count;
      this.logger.log(
        `Prisma deleted ${prismaDeletedCount} users from DB out of ${userIds.length} requested.`,
      );
    } catch (error) {
      this.logger.error(
        `Prisma error during deleteMany for UIDs ${userIds.join(', ')}:`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to delete users from Prisma DB. Firebase deletions: ${firebaseResult.successCount} succeeded, ${firebaseResult.failureCount} failed. Prisma error: ${(error as Error).message}`,
      );
    }

    let summaryMessage = `Processed deletion for ${userIds.length} user IDs. `;
    summaryMessage += `Firebase: ${firebaseResult.successCount} deleted, ${firebaseResult.failureCount} failed. `;
    summaryMessage += `Prisma DB: ${prismaDeletedCount} deleted.`;
    if (firebaseResult.failureCount > 0)
      summaryMessage += ` Check 'firebase.errors' for details on Firebase failures.`;

    const expectedDbDeletes =
      userIds.length -
      firebaseErrorsFormatted.filter(
        (err) => err.code !== 'auth/user-not-found',
      ).length;
    if (prismaDeletedCount < expectedDbDeletes) {
      summaryMessage += ` Some users might not have been found in the DB or an error occurred during their deletion.`;
    }

    return {
      message: summaryMessage,
      firebase: {
        successCount: firebaseResult.successCount,
        failureCount: firebaseResult.failureCount,
        errors: firebaseErrorsFormatted,
      },
      prisma: {
        deletedCount: prismaDeletedCount,
        requestedCount: userIds.length,
      },
    };
  }
}
