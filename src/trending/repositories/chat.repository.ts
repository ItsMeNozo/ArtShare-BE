import { Injectable } from '@nestjs/common';
import { Conversation, Message } from 'src/generated';
import { PrismaService } from 'src/prisma.service';
import {
  CreateMessageData,
  IChatRepository,
} from '../interfaces/chat-repository.interface';

@Injectable()
export class ChatRepository implements IChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(
    userId: string,
    title?: string,
  ): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: {
        userId,
        title: title || 'New Conversation',
      },
    });
  }

  async getConversationById(
    id: string,
    userId: string,
  ): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50, // Limit for performance
        },
      },
    });
  }

  async getUserConversations(
    userId: string,
    limit = 20,
  ): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Only get the last message
        },
      },
    });
  }

  async createMessage(data: CreateMessageData): Promise<Message> {
    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        metadata: data.metadata,
      },
    });

    // Update conversation's lastMessageAt
    await this.prisma.conversation.update({
      where: { id: data.conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  async getConversationMessages(
    conversationId: string,
    limit = 50,
  ): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async getRecentUserPrompts(userId: string, days: number): Promise<string[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const artGenerations = await this.prisma.artGeneration.findMany({
      select: {
        final_prompt: true,
      },
      orderBy: { created_at: 'desc' },
      take: 30,
    });

    return artGenerations.map(
      (ag: { final_prompt: string }) => ag.final_prompt,
    );
  }
}
