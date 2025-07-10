import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/users.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/request/create-message.dto';
import {
  ConversationResponseDto,
  MessageResponseDto,
} from './dto/response/generated-prompt.dto';
import { TrendingService } from './trending.service';

@Controller('trending')
@UseGuards(JwtAuthGuard)
export class TrendingController {
  constructor(
    private readonly trendingService: TrendingService,
    private readonly chatService: ChatService,
  ) {}

  @Get('promtps')
  async getTrendingPrompts() {
    return this.trendingService.getTrendingPrompts();
  }

  @Post('messages')
  async sendMessage(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.chatService.sendMessage(user.id, dto);
  }

  @Get('conversations')
  async getUserConversations(
    @CurrentUser() user: { id: string },
  ): Promise<ConversationResponseDto[]> {
    return this.chatService.getUserConversations(user.id);
  }

  @Get('conversations/:id')
  async getConversation(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
  ): Promise<ConversationResponseDto> {
    return this.chatService.getConversation(user.id, conversationId);
  }
}
