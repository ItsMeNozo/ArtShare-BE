import { Controller, Get, Post, Body, UseGuards, Logger, Req } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);
  
  constructor(private notificationsService: NotificationService) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.notificationsService.getUserNotifications(user.id);
  }

  @Get('count')
  async getUnreadCount(
    @CurrentUser() user: CurrentUserType,
  ) {
    const count = await this.notificationsService.getUnreadNotificationCount(user.id);
    return { count };
  }

  @Post('read')
  async markAsRead(@Body('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Post('test')
  async sendTestNotification(@CurrentUser() user: CurrentUserType) {
    const startTime = Date.now();
    this.logger.log(`[${startTime}] Test notification requested by user ${user.id}`);
    
    // Send a test notification for debugging
    await this.notificationsService.createAndPush(
      user.id,
      'TEST_NOTIFICATION',
      {
        message: 'This is a test notification to verify real-time WebSocket delivery.',
        timestamp: new Date().toISOString(),
        testStartTime: startTime,
      }
    );
    
    const endTime = Date.now();
    this.logger.log(`[${endTime}] Test notification completed in ${endTime - startTime}ms`);
    
    return { 
      success: true, 
      message: 'Test notification sent',
      timing: {
        startTime,
        endTime,
        duration: endTime - startTime
      }
    };
  }

  @Get('connection-status')
  @ApiOperation({ summary: 'Get WebSocket connection status for the current user' })
  @ApiResponse({ status: 200, description: 'Connection status retrieved successfully' })
  getConnectionStatus(@Req() req: any) {
    const userId = req.user.id;
    this.logger.log(`Connection status check requested by user ${userId}`);
    
    const status = this.notificationsService.getConnectionStatus(userId);
    
    this.logger.log(`Connection status for user ${userId}: ${JSON.stringify(status)}`);
    
    return {
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    };
  }

  @Post('debug/force-connect')
  @ApiOperation({ summary: 'Debug endpoint to check if notifications can be sent' })
  @ApiResponse({ status: 200, description: 'Debug connection check completed' })
  async debugForceConnect(@Req() req: any) {
    const userId = req.user.id;
    this.logger.log(`Debug force connect requested by user ${userId}`);
    
    // Check current connection status
    const status = this.notificationsService.getConnectionStatus(userId);
    
    // Send a debug ping to see if the connection works
    this.notificationsService.sendDebugPing(userId, {
      message: 'Debug ping from server',
      timestamp: new Date().toISOString(),
      connectionStatus: status
    });
    
    return {
      success: true,
      message: 'Debug ping sent',
      connectionStatus: status,
      timestamp: new Date().toISOString()
    };
  }

  @Get('debug/connections')
  @ApiOperation({ summary: 'Get all WebSocket connections (debug)' })
  @ApiResponse({ status: 200, description: 'WebSocket connections retrieved' })
  async getConnections() {
    return await this.notificationsService.getAllConnections();
  }

  @Get('debug/cors')
  @ApiOperation({ summary: 'Get CORS configuration (debug)' })
  @ApiResponse({ status: 200, description: 'CORS configuration retrieved' })
  async getCorsConfig() {
    return {
      allowedOrigins: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        process.env.ADMIN_FRONTEND_URL || 'http://localhost:1574',
      ],
      environment: process.env.NODE_ENV || 'development',
      currentOrigins: {
        frontend: process.env.FRONTEND_URL,
        admin: process.env.ADMIN_FRONTEND_URL
      }
    };
  }
}
