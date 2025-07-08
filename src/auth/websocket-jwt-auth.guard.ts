import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WebSocketJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketJwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.logger.log('Guard instantiated.');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check the context type. If it's HTTP, let it pass.
    // We assume another guard (like AuthGuard('jwt')) handles HTTP routes.
    if (context.getType() === 'http') {
      return true;
    }

    // It's a WebSocket connection, so proceed with WebSocket logic.
    this.logger.log('--- WS canActivate START ---');
    const client: Socket = context.switchToWs().getClient();

    try {
      const token = client.handshake.auth?.token;
      this.logger.log(`Token from handshake.auth: ${token}`);

      if (!token) {
        throw new WsException('Unauthorized: No token provided');
      }

      const secret = this.configService.get<string>('AT_SECRET');
      this.logger.log(
        `Verifying with secret: ${secret ? '*** (found)' : '!!! UNDEFINED !!!'}`,
      );
      if (!secret) {
        throw new WsException(
          'Server misconfiguration: JWT secret is not set.',
        );
      }

      const payload = await this.jwtService.verifyAsync(token, { secret });
      this.logger.log(
        `...verifyAsync SUCCEEDED. Payload: ${JSON.stringify(payload)}`,
      );

      client.data.user = payload;
      this.logger.log(
        `...attach COMPLETE. client.data is now: ${JSON.stringify(client.data)}`,
      );

      this.logger.log('--- WS canActivate END (SUCCESS) ---');
      return true;
    } catch (error) {
      this.logger.error(`--- WS canActivate END (FAILURE) ---`);
      this.logger.error(
        `Authentication error: ${error instanceof Error ? error.message : String(error)}`,
      );

      // We must explicitly tell the client to disconnect on failure
      client.emit('error', {
        message:
          'Authentication failed. ' +
          (error instanceof Error ? error.message : String(error)),
      });
      client.disconnect(true);

      // Return false to prevent the connection from proceeding.
      return false;
    }
  }
}
