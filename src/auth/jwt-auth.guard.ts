// src/auth/jwt-auth.guard.ts (adjust path as necessary)

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException, // Optional: for config errors
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config'; // <-- Import ConfigService
import { Request } from 'express';
import { JwtPayload } from './types/jwtPayload.type'; // Adjust path if needed

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService, // <-- Inject ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    const secret = this.configService.get<string>('AT_SECRET');

    if (!secret) {
      console.error(
        'FATAL ERROR: JWT_ACCESS_SECRET is not defined in the environment variables.',
      );
      throw new InternalServerErrorException(
        'Authentication configuration error.',
      );
    }

    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: secret,
      });

      request['user'] = {
        ...payload,
        id: payload.userId, // Map userId from payload to id on the request user object
      };
    } catch (error: any) {
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid authentication token');
      } else if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Authentication token has expired');
      } else {
        console.error('JWT verification failed:', error); // Log unexpected errors
        throw new UnauthorizedException('Authentication failed'); // General fallback
      }
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
