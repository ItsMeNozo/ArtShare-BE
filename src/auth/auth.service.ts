import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as admin from 'firebase-admin'; // Firebase Admin SDK
import { nanoid } from 'nanoid';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';
import { PaidAccessLevel, Prisma } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import { Role } from './enums/role.enum';
import { JwtPayload } from './types/jwtPayload.type';
import { Tokens } from './types/tokens.type';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}
  private readonly logger = new Logger(AuthService.name); // Create an instance of Logger for this service
  // Đăng ký người dùng mới
  async signup(
    userId: string,
    email: string,
    password: string | '',
    username: string,
  ): Promise<any> {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      this.logger.log(username);
      if (existingUser) {
        // return to let frontend know that user already signup
        return {
          message_type: 'USER_ALREADY_EXIST',
          user: existingUser,
        };
      }

      const userRole = await this.prisma.role.findUnique({
        where: { role_name: 'USER' },
        select: { role_id: true }, // Only fetch the role_id
      });

      if (!userRole) {
        this.logger.error(
          "Default 'USER' role not found in the database. Please run seeding.",
        );
        throw new NotFoundException(
          'System configuration error: Default user role not found.',
        );
      }

      const newUser = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const user = await tx.user.create({
            data: {
              id: userId,
              email,
              username: this.createRandomUsername(),
            },
          });

          await tx.userRole.create({
            data: {
              user_id: user.id,
              role_id: userRole.role_id,
            },
          });

          // add free plan to user
          // 2️⃣ create the free‐plan access
          const access = await tx.userAccess.create({
            data: {
              userId: user.id,
              planId: PaidAccessLevel.FREE,
              expiresAt: new Date('9999-12-31T23:59:59.999Z'),
              stripeSubscriptionId: `${user.id}_${nanoid()}`,
              stripePriceId: 'free',
              stripeCustomerId: user.id,
            },
          });

          // 3️⃣ seed the initial usage record so that it lasts until `access.expiresAt`
          await tx.userUsage.create({
            data: {
              userId: user.id,
              featureKey: FeatureKey.AI_CREDITS,
              usedAmount: 0,
              cycleStartedAt: new Date(),
              cycleEndsAt: access.expiresAt, // ← bound it to the FREE plan’s expiry
            },
          });

          return user;
        },
      );

      return { message_type: 'SIGNUP_SUCCESS', newUser };
    } catch (error) {
      throw new Error(`Error creating user: ${(error as Error).message}`);
    }
  }

  async login(token: string) {
    try {
      // Verify the Firebase ID Token
      const decodedToken = await admin.auth().verifyIdToken(token);
      this.logger.log(
        'Decoded token successfully from login: ' +
          JSON.stringify(decodedToken),
      );
      const userFromDb = await this.prisma.user.findUnique({
        where: { id: decodedToken.uid },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
      if (!userFromDb) {
        throw new Error(
          `User with email ${decodedToken.email}, and id ${decodedToken.uid} not found in database`,
        );
      }

      // Extract role names from the nested structure
      const roleNames = userFromDb.roles.map(
        (userRole) => userRole.role.role_name,
      );
      this.logger.log(`User roles extracted: ${roleNames}`);

      const tokens = await this.getTokens(
        userFromDb.id,
        decodedToken.email!,
        roleNames,
      );
      // Create access_token, refresh_token
      let user = null;
      this.logger.log(user);
      try {
        user = await this.prisma.user.update({
          where: { id: decodedToken.uid }, // Tìm user theo email từ Firebase token
          data: { refresh_token: tokens.refresh_token }, // Cập nhật refresh_token
        });
        this.logger.log(
          `Refresh token updated for user with email: ${decodedToken.email}`,
        );
      } catch (dbError) {
        this.logger.error(
          'Error updating refresh token in database:',
          (dbError as Error).stack,
        ); // Quyết định xem bạn có muốn throw lỗi ở đây hay không.
        // Nếu việc cập nhật refresh token thất bại, có thể ảnh hưởng đến việc làm mới token sau này.
        // Tùy thuộc vào yêu cầu nghiệp vụ của bạn.
        // Có thể bạn chỉ muốn log lỗi và tiếp tục.
      }

      // Store access_token, refresh_token
      // Return user information (can be customized to return more details or save to DB)
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      };
    } catch (error) {
      this.logger.error(
        'Error during token verification',
        (error as Error).stack,
      ); // Log the error message and stack trace

      // Handle specific Firebase error codes if necessary
      if ((error as admin.FirebaseError).code === 'auth/argument-error') {
        this.logger.error('The ID token is invalid or malformed.');
        throw new Error('The ID token is invalid or malformed.');
      }

      // General error handling
      this.logger.error('Invalid token', (error as Error).stack);
      throw new Error('Invalid token');
    }
  }

  async loginAdmin(token: string) {
    const decoded = await admin.auth().verifyIdToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: decoded.uid },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const roleNames = user.roles.map((r) => r.role.role_name);
    if (!roleNames.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin access required');
    }
    const tokens = await this.getTokens(user.id, decoded.email!, roleNames);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refresh_token: tokens.refresh_token },
    });
    return tokens;
  }

  // Đăng xuất (tạm thời chỉ xóa refresh token trên Firebase, tuỳ chỉnh theo yêu cầu)
  async signout(uid: string) {
    try {
      // Xóa refresh token hoặc bất kỳ hành động logout nào của Firebase
      await admin.auth().revokeRefreshTokens(uid);
      return { message: 'User signed out successfully' };
    } catch (error) {
      throw new Error(`Error signing out: ${(error as Error).message}`);
    }
  }

  // Xác minh token Firebase để bảo vệ route
  async verifyToken(idToken: string) {
    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      this.logger.error((error as Error).stack);
      throw new UnauthorizedException(
        'You are not authorized to access this resource',
      );
    }
  }

  async getTokens(
    userId: string,
    email: string,
    roles: string[],
  ): Promise<Tokens> {
    const jwtPayload: JwtPayload = {
      userId: userId,
      email: email,
      roles: roles,
    };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: this.config.get<string>('AT_SECRET'),
        expiresIn: '1000d',
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: this.config.get<string>('RT_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }

  createRandomUsername(): string {
    return `user_${crypto.randomUUID()}`;
  }
}
