import { forwardRef, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CorsService } from '../common/cors.service';
import { NotificationService } from './notification.service';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      // Use static methods from CorsService for consistency
      const isProduction = CorsService.isProductionStatic();
      const allowedOrigins = CorsService.getAllowedOriginsStatic();

      // Use a static logger since this runs before class instantiation
      const logger = NotificationsGateway.getStaticLogger();

      // Debug logging for WebSocket CORS (only in non-production)
      if (!isProduction) {
        logger.debug(`=== WebSocket CORS DEBUG ===`);
        logger.debug(`NODE_ENV: ${process.env.NODE_ENV}`);
        logger.debug(`isProduction: ${isProduction}`);
        logger.debug(`FRONTEND_URL from env: ${process.env.FRONTEND_URL}`);
        logger.debug(
          `ADMIN_FRONTEND_URL from env: ${process.env.ADMIN_FRONTEND_URL}`,
        );
        logger.debug(`WebSocket origin: ${origin}`);
        logger.debug(`Allowed origins: ${allowedOrigins.join(', ')}`);
        logger.debug(`=== END WebSocket CORS DEBUG ===`);
      }

      // Allow same-origin requests and specified origins
      if (!origin || allowedOrigins.includes(origin)) {
        logger.log(
          `✅ WebSocket CORS allowed origin: ${origin || 'same-origin'}`,
        );
        callback(null, true);
      } else if (!isProduction) {
        // In development, allow localhost with any port
        if (origin.match(/^https?:\/\/localhost:\d+$/)) {
          logger.log(`✅ WebSocket CORS allowed localhost origin: ${origin}`);
          callback(null, true);
        } else {
          logger.warn(
            `❌ WebSocket CORS blocked origin in development: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`,
          );
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        logger.warn(
          `❌ WebSocket CORS blocked origin in production: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`,
        );
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Static logger for use in decorator context
  private static readonly staticLogger = new Logger('NotificationsGateway');

  // Changed to store multiple connections per user
  private connectedClients = new Map<string, Set<Socket>>();
  private readonly logger = new Logger(NotificationsGateway.name);

  // Static method to access the logger from decorator context
  static getStaticLogger() {
    return NotificationsGateway.staticLogger;
  }

  constructor(
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(
      `WebSocket connection from origin: ${client.handshake.headers.origin}, IP: ${client.handshake.address}, Socket ID: ${client.id}`,
    );

    try {
      // Manually verify the JWT token since guards have timing issues with handleConnection
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        this.logger.error('No token provided in handshake');
        client.emit('error', {
          message: 'Authentication failed: No token provided',
        });
        client.disconnect();
        return;
      }

      // Verify the token
      const secret = this.configService.get<string>('AT_SECRET');
      if (!secret) {
        this.logger.error('JWT secret not configured');
        client.emit('error', { message: 'Server configuration error' });
        client.disconnect();
        return;
      }

      let payload: any;
      try {
        payload = await this.jwtService.verifyAsync(token, { secret });
      } catch (error) {
        this.logger.error(
          `Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        client.emit('error', {
          message: 'Authentication failed: Invalid token',
        });
        client.disconnect();
        return;
      }

      const userId = payload.userId;
      if (!userId) {
        this.logger.error('No userId in token payload');
        client.emit('error', {
          message: 'Authentication failed: Invalid token payload',
        });
        client.disconnect();
        return;
      }

      // Store user data on the socket for later use
      client.data.user = payload;

      // Get or create the set of connections for this user
      if (!this.connectedClients.has(userId)) {
        this.connectedClients.set(userId, new Set());
      }
      this.connectedClients.get(userId)!.add(client);

      // Send undelivered notifications to the new connection
      const undelivered =
        await this.notificationService.getUndeliveredNotifications(userId);

      for (const notif of undelivered) {
        client.emit('new-notification', notif);
      }
      this.logger.log(
        `Sent ${undelivered.length} undelivered notifications to user ${userId}`,
      );
    } catch (error) {
      this.logger.error('Error in handleConnection:', error);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Find the user ID for this specific socket
    const userId = Array.from(this.connectedClients.entries()).find(
      ([_, sockets]) => sockets.has(client),
    )?.[0];

    if (userId) {
      const userConnections = this.connectedClients.get(userId)!;
      userConnections.delete(client);

      // Remove the user entry if no connections remain
      if (userConnections.size === 0) {
        this.connectedClients.delete(userId);
      }
    }
  }

  sendToUser(userId: string, event: string, data: any) {
    const userConnections = this.connectedClients.get(userId);
    if (userConnections && userConnections.size > 0) {
      // Clean up disconnected sockets first
      const connectedSockets = Array.from(userConnections).filter(
        (client) => client.connected,
      );

      // Update the set with only connected sockets
      if (connectedSockets.length !== userConnections.size) {
        // Incrementally remove stale sockets
        for (const socket of userConnections) {
          if (!socket.connected) {
            userConnections.delete(socket);
          }
        }

        // Remove the user entry if no connections remain
        if (connectedSockets.length === 0) {
          this.connectedClients.delete(userId);
          return;
        }
      }

      // Send to all connected sockets for this user
      // This ensures all tabs/windows receive the notification
      connectedSockets.forEach((socket) => {
        socket.emit(event, data);
      });
    }
  }

  // Periodic cleanup method to remove stale connections
  private cleanupStaleConnections() {
    for (const [userId, userConnections] of this.connectedClients.entries()) {
      const connectedSockets = Array.from(userConnections).filter(
        (client) => client.connected,
      );

      if (connectedSockets.length === 0) {
        this.connectedClients.delete(userId);
      } else if (connectedSockets.length !== userConnections.size) {
        userConnections.clear();
        connectedSockets.forEach((socket) => userConnections.add(socket));
      }
    }
  }

  // Call this method periodically (you can add a cron job or call it from a scheduled task)
  cleanupConnections() {
    this.cleanupStaleConnections();
  }

  getUserConnectionStatus(userId: string) {
    const userConnections = this.connectedClients.get(userId);
    const connectedCount = userConnections ? userConnections.size : 0;
    const isConnected = connectedCount > 0;

    return {
      isConnected,
      connectionCount: connectedCount,
      connections: Array.from(userConnections || []).map((socket) => ({
        id: socket.id,
        connected: socket.connected,
        address: socket.handshake.address,
      })),
    };
  }
}
