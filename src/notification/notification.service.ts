import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma.service';
import { NotificationUtils } from '../common/utils/notification.utils';
import type { NotificationsGateway } from './notification.gateway';

interface UserFollowPayload {
  followerId: string;
  followingId: string;
}

interface NotificationTemplate {
  template: string;
  fallback?: string;
}

interface PushNotificationPayload {
  from: string;
  to: string;
  type: string; // 'artwork_published', 'artwork_liked', 'artwork_commented', 'user_followed', etc.
  content?: string; // Optional fallback content
  createdAt: string;
  // Navigation data
  postId?: string;
  commentId?: string;
  postTitle?: string;
  // Dynamic data for templates
  [key: string]: any;
}

interface InterpolationContext {
  users?: Record<string, string>;
  [key: string]: any;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      forwardRef(() => require('./notification.gateway').NotificationsGateway),
    )
    private notificationsGateway: NotificationsGateway,
  ) {}

  private readonly logger = new Logger(NotificationService.name);

  // Template definitions based on notification type
  private readonly templates: Record<string, NotificationTemplate> = {
    artwork_published: {
      template: '{{user:from}} published new post: "{{post.title}}"',
      fallback: 'New post published',
    },
    artwork_liked: {
      template: '{{user:from}} liked your post',
      fallback: 'Someone liked your post',
    },
    artwork_commented: {
      template: '{{user:from}} commented on your post',
      fallback: 'Someone commented on your post',
    },
    user_followed: {
      template: '{{user:from}} started following you',
      fallback: 'You have a new follower',
    },
    artwork_shared: {
      template: '{{user:from}} shared your post "{{post.title}}"',
      fallback: 'Someone shared your post',
    },
    collection_added: {
      template:
        '{{user:from}} added your post "{{post.title}}" to their collection',
      fallback: 'Your post was added to a collection',
    },
    commission_requested: {
      template: '{{user:from}} sent you a commission request',
      fallback: 'You have a new commission request',
    },
    report_resolved: {
      template:
        'Your report regarding "{{reason}}" has been reviewed and resolved',
      fallback: 'Your report has been resolved',
    },
    report_created: {
      template:
        '{{user:from}} has reported {{report.target_type}} {{report.target_title}}',
      fallback: 'A new user has filed a report',
    },
  };

  /**
   * Create notification with template interpolation and push via WebSocket
   */
  async createAndPush(userId: string, type: string, payload: object) {
    const startTime = Date.now();
    this.logger.debug(
      `[${startTime}] Creating and pushing notification to user ${userId}, type: ${type}`,
    );

    const notification = await this.create(userId, type, payload);
    const createTime = Date.now();
    this.logger.debug(
      `[${createTime}] Notification ${notification.id} created in ${createTime - startTime}ms`,
    );

    this.logger.debug(
      `[${createTime}] Sending notification ${notification.id} to user ${userId} via WebSocket`,
    );
    this.notificationsGateway.sendToUser(
      userId,
      'new-notification',
      notification,
    );

    const endTime = Date.now();
    this.logger.log(
      `[${endTime}] Notification ${notification.id} sent to user ${userId} - Total time: ${endTime - startTime}ms`,
    );
    return notification;
  }

  async create(userId: string, type: string, payload: object) {
    const message = await this.interpolateMessage(type, payload);

    return this.prisma.notification.create({
      data: {
        userId: userId,
        type,
        payload: {
          ...payload,
          message, // Add interpolated message to payload
        },
      },
    });
  }

  private extractUserIdsFromContext(template: string, context: any): string[] {
    const userPlaceholderPattern = /\{\{user:(\w+)\}\}/g;
    const matches = Array.from(template.matchAll(userPlaceholderPattern));
    const userIds: string[] = [];

    for (const match of matches) {
      const placeholder = match[1]; // e.g., 'from', 'to', etc.
      const userId = context[placeholder];

      if (userId && typeof userId === 'string') {
        userIds.push(userId);
      }
    }

    return [...new Set(userIds)];
  }

  private async interpolateMessage(
    type: string,
    context: any,
  ): Promise<string> {
    const template = this.templates[type];

    if (!template) {
      return context.content || context.message || `New ${type} notification`;
    }

    const userIds = this.extractUserIdsFromContext(template.template, context);
    // const userIds = [context.from, context.to];

    if (userIds.length === 0) {
      return this.simpleInterpolate(template.template, context);
    }

    const userMap = await this.fetchUsernames(userIds);

    if (Object.keys(userMap).length === 0 && userIds.length > 0) {
      return template.fallback || context.content || `New ${type} notification`;
    }

    const fullContext: InterpolationContext = {
      ...context,
      users: userMap,
    };

    const resultString = this.interpolateWithContext(
      template.template,
      fullContext,
    );
    return resultString;
  }

  /**
   * Batch fetch usernames from database
   */
  private async fetchUsernames(
    userIds: string[],
  ): Promise<Record<string, string>> {
    if (userIds.length === 0) return {};

    try {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          username: true,
        },
      });

      return users.reduce(
        (acc, user) => {
          acc[user.id] = user.username;
          return acc;
        },
        {} as Record<string, string>,
      );
    } catch (error) {
      this.logger.error('Failed to fetch usernames:', error);
      return {};
    }
  }

  private interpolateWithContext(
    template: string,
    context: InterpolationContext,
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      if (key.startsWith('user:')) {
        const placeholder = key.substring(5);
        const userId = context[placeholder]; // Get the actual user ID from context

        if (userId && context.users?.[userId]) {
          return context.users[userId]; // Return the username
        }

        return placeholder;
      }

      const value = this.resolveContextValue(key, context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Simple interpolation without user resolution
   */
  private simpleInterpolate(template: string, context: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = this.resolveContextValue(key, context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Resolve context value supporting nested keys
   */
  private resolveContextValue(key: string, context: InterpolationContext): any {
    if (key.startsWith('user:')) {
      const userId = key.substring(5);
      return context.users?.[userId];
    }

    return key.split('.').reduce((obj, prop) => obj?.[prop], context);
  }

  // === Existing methods remain unchanged ===

  async getUserNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 notifications
    });
    return notifications;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
    return count;
  }

  async markAsRead(notificationId: string) {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    this.logger.log(`markAllAsRead for user ${userId}`);
    await this.prisma.notification.updateMany({
      where: { userId: userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUndeliveredNotifications(userId: string) {
    this.logger.log(`getUndeliveredNotifications for user ${userId}`);
    return this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markAsDelivered(notificationId: string) {
    this.logger.log(`markAsDelivered for notification ${notificationId}`);
    // Note: Currently using isRead for delivery tracking
    // In the future, consider adding a separate 'delivered' field to the schema
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async getConnectionStatus(userId: string) {
    this.logger.log(`Getting connection status for user ${userId}`);
    return this.notificationsGateway.getUserConnectionStatus(userId);
  }

  async sendDebugPing(userId: string, data: any) {
    this.logger.log(`Sending debug ping to user ${userId}`);
    this.notificationsGateway.sendToUser(userId, 'debug-ping', data);
  }

  async getAllConnections() {
    this.logger.log('Getting all WebSocket connections');
    const gateway = this.notificationsGateway;
    const connectedClients = gateway['connectedClients'] as Map<
      string,
      Set<any>
    >;

    const connections = Array.from(connectedClients.entries()).map(
      ([userId, sockets]) => ({
        userId,
        connectionCount: sockets.size,
        connections: Array.from(sockets).map((socket: any) => ({
          id: socket.id,
          connected: socket.connected,
          address: socket.handshake?.address,
          userAgent: socket.handshake?.headers?.['user-agent'],
          origin: socket.handshake?.headers?.origin,
        })),
      }),
    );

    return {
      totalUsers: connections.length,
      totalConnections: connections.reduce(
        (sum, user) => sum + user.connectionCount,
        0,
      ),
      connections,
    };
  }

  @OnEvent('report.resolved')
  async handleReportResolved(payload: {
    reporterId: string;
    reportId: string;
    reason: string;
    resolvedAt: string;
  }) {
    this.logger.log('Caught report.resolved event, creating notification...');

    const notificationType = 'REPORT_RESOLVED';

    // Check if a notification for this report resolution already exists
    // to prevent duplicate notifications
    const existingNotification = await this.prisma.notification.findFirst({
      where: {
        userId: payload.reporterId,
        type: notificationType,
        payload: {
          path: ['reportId'],
          equals: payload.reportId,
        },
      },
    });

    if (existingNotification) {
      this.logger.log(
        `Notification for report ${payload.reportId} already exists for user ${payload.reporterId}, skipping duplicate`,
      );
      return;
    }

    try {
      await this.createAndPush(payload.reporterId, 'report_resolved', payload);
      this.logger.log(
        `Notification successfully created & pushed to user ${payload.reporterId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create/push notification for user ${payload.reporterId}:`,
        (error as Error).stack,
      );
    }
  }

  @OnEvent('push-notification')
  async handlePushNotification(payload: PushNotificationPayload) {
    this.logger.log(
      `Caught push-notification event (type: ${payload.type}), creating notification...`,
    );

    // Prevent self-notifications using centralized utility
    if (!NotificationUtils.shouldSendNotification(payload.from, payload.to)) {
      return;
    }

    try {
      // The template interpolation happens automatically in create() method
      // based on the payload.type
      const newNotification = await this.createAndPush(
        payload.to,
        payload.type, // Use the specific type for template selection
        payload,
      );
      this.logger.log(
        `Push notification (${payload.type}) successfully created & pushed to user ${payload.to}, ID: ${newNotification.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create/push notification for user ${payload.to}:`,
        (error as Error).stack,
      );
    }
  }

  @OnEvent('user.followed.update-counts')
  async handleUpdateFollowCounts(payload: UserFollowPayload) {
    this.logger.log(
      `BACKGROUND JOB: Caught 'user.followed.update-counts' for ${payload.followerId} -> ${payload.followingId}`,
    );

    try {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: payload.followerId },
          data: { followingsCount: { increment: 1 } },
        }),
        this.prisma.user.update({
          where: { id: payload.followingId },
          data: { followersCount: { increment: 1 } },
        }),
      ]);
    } catch (error) {
      // In a production system, you might add this to a retry queue (e.g., BullMQ)
      this.logger.error(
        `Failed to update follow counts for payload: ${JSON.stringify(payload)}`,
        (error as Error).stack,
      );
    }
  }

  @OnEvent('user.unfollowed.update-counts')
  async handleUpdateUnfollowCounts(payload: UserFollowPayload) {
    this.logger.log(
      `BACKGROUND JOB: Caught 'user.unfollowed.update-counts' for ${payload.followerId} -> ${payload.followingId}`,
    );

    try {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: payload.followerId },
          data: { followingsCount: { decrement: 1 } },
        }),
        this.prisma.user.update({
          where: { id: payload.followingId },
          data: { followersCount: { decrement: 1 } },
        }),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to update unfollow counts for payload: ${JSON.stringify(payload)}`,
        (error as Error).stack,
      );
    }
  }

  @OnEvent('post.viewed')
  async handlePostViewedEvent(payload: { postId: number }) {
    try {
      await this.prisma.post.update({
        where: { id: payload.postId },
        data: { viewCount: { increment: 1 } },
      });
    } catch (error) {
      this.logger.error(
        `Failed to increment view count for post ID ${payload.postId}:`,
        (error as Error).stack,
      );
    }
  }

  @OnEvent('blog.viewed')
  async handleBlogViewedEvent(payload: { blogId: number }) {
    try {
      await this.prisma.blog.update({
        where: { id: payload.blogId },
        data: { viewCount: { increment: 1 } },
      });
    } catch (error) {
      this.logger.error(
        `Failed to increment view count for post ID ${payload.blogId}:`,
        (error as Error).stack,
      );
    }
  }
}
