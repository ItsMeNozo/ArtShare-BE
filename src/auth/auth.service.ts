import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin'; // Firebase Admin SDK
import { PrismaService } from 'src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
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

      const user = await this.prisma.user.create({
        data: {
          id: userId,
          email,
          password_hash: password ? password : '', // If password is null, we can store it as null or handle accordingly
          username: this.createRandomUsername(),
        },
      });

      return { message_type: 'SIGNUP_SUCCESS', user };
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  async login(token: string) {
    try {
      this.logger.log('Received token for verification', token); // Log a message for debugging

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
          `User with email ${decodedToken.email} not found in database`,
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
      console.log('tokens: ', tokens);
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
          dbError.stack,
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
      this.logger.error('Error during token verification', error.stack); // Log the error message and stack trace

      // Handle specific Firebase error codes if necessary
      if (error.code === 'auth/argument-error') {
        this.logger.error('The ID token is invalid or malformed.');
        throw new Error('The ID token is invalid or malformed.');
      }

      // General error handling
      this.logger.error('Invalid token', error.stack);
      throw new Error('Invalid token');
    }
  }

  // Đăng xuất (tạm thời chỉ xóa refresh token trên Firebase, tuỳ chỉnh theo yêu cầu)
  async signout(uid: string) {
    try {
      // Xóa refresh token hoặc bất kỳ hành động logout nào của Firebase
      await admin.auth().revokeRefreshTokens(uid);
      return { message: 'User signed out successfully' };
    } catch (error) {
      throw new Error(`Error signing out: ${error.message}`);
    }
  }

  // Xác minh token Firebase để bảo vệ route
  async verifyToken(idToken: string) {
    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      this.logger.error(error.stack);
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
