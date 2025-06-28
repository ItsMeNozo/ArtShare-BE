import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from './types/jwtPayload.type';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);
  
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    this.logger.debug('=== DEBUG: OptionalJwtAuthGuard ===');
    this.logger.debug(`Token found: ${!!token}`);

    // If no token is provided, allow access but set user to null
    if (!token) {
      this.logger.debug('No token provided, setting user to null');
      request.user = null;
      return true;
    }    const secret = this.configService.get<string>('AT_SECRET');

    if (!secret) {
      this.logger.debug('JWT secret not configured, setting user to null');
      request.user = null;
      return true;
    }

    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: secret,
      });
      
      this.logger.debug(`JWT verified successfully for user: ${payload.userId}`);
      
      // Set user on request with same structure as JwtAuthGuard
      request.user = {
        ...payload,
        id: payload.userId, // Map userId from payload to id
      };
      
      this.logger.debug(`User set on request: ${payload.userId}`);
      return true;
    } catch (error: any) {
      this.logger.debug(`JWT verification failed: ${error.message}`);
      this.logger.debug('Setting user to null and allowing access');
      
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
