import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from './types/jwtPayload.type';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    console.log('=== DEBUG: OptionalJwtAuthGuard ===');
    console.log('Token found:', !!token);

    // If no token is provided, allow access but set user to null
    if (!token) {
      console.log('No token provided, setting user to null');
      request.user = null;
      return true;
    }

    const secret = this.configService.get<string>('AT_SECRET');

    if (!secret) {
      console.log('JWT secret not configured, setting user to null');
      request.user = null;
      return true;
    }

    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: secret,
      });
      
      console.log('JWT verified successfully:', payload);
      
      // Set user on request with same structure as JwtAuthGuard
      request.user = {
        ...payload,
        id: payload.userId, // Map userId from payload to id
      };
      
      console.log('User set on request:', request.user);
      return true;
    } catch (error: any) {
      console.log('JWT verification failed:', error.message);
      console.log('Setting user to null and allowing access');
      
      // If token verification fails, still allow access but set user to null
      request.user = null;
      return true;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
