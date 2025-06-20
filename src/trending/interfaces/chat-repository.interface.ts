import { Conversation, Message, MessageRole } from 'src/generated';

export interface IChatRepository {
  createConversation(userId: string, title?: string): Promise<Conversation>;
  getConversationById(id: string, userId: string): Promise<Conversation | null>;
  getUserConversations(userId: string, limit?: number): Promise<Conversation[]>;
  createMessage(data: CreateMessageData): Promise<Message>;
  getConversationMessages(
    conversationId: string,
    limit?: number,
  ): Promise<Message[]>;
  getRecentUserPrompts(userId: string, days: number): Promise<string[]>;
}

export interface CreateMessageData {
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata?: any;
}
