// src/modules/chat/services/chat.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MessageRole } from 'src/generated';
import { SimpleCacheService } from 'src/infastructure/simple-cache.service';
import { CreateMessageDto } from './dto/request/create-message.dto';
import {
  ConversationResponseDto,
  GeneratedPrompt,
  MessageResponseDto,
} from './dto/response/generated-prompt.dto';
import { GeminiService } from './gemini.service';
import { ChatRepository } from './repositories/chat.repository';

@Injectable()
export class ChatService {
  private readonly PROMPT_HISTORY_DAYS = 7;
  private readonly CONVERSATION_CONTEXT_LIMIT = 10;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly geminiService: GeminiService,
    private readonly cacheService: SimpleCacheService,
  ) {}

  async sendMessage(
    userId: string,
    dto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    let conversationId = dto.conversationId;
    let conversation = [];

    if (!conversationId) {
      conversationId = `${Math.floor(Math.random() * 100) + 1}`;
      await this.cacheService.set(conversationId, []);
    } else {
      // array of chats
      conversation = (await this.cacheService.get<any[]>(conversationId)) ?? [];
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
    }
    conversation.push(dto.content);
    this.cacheService.set(conversationId, conversation);

    // this.logger.debug(`Current prompt: ${conversation}`);

    const generatedPrompts = await this.generateChatResponse(
      [''],
      conversation,
    );

    // const assistantMessage = await this.chatRepository.createMessage({
    //   conversationId,
    //   role: MessageRole.ASSISTANT,
    //   content: '',
    //   metadata: { generatedPrompts },
    // });

    return this.mapToMessageResponse(
      {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: '',
        metadata: {},
      },
      generatedPrompts,
    );
  }

  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.chatRepository.getConversationById(
      conversationId,
      userId,
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.mapToConversationResponse(conversation);
  }

  async getUserConversations(
    userId: string,
  ): Promise<ConversationResponseDto[]> {
    const conversations =
      await this.chatRepository.getUserConversations(userId);
    return conversations.map((conv: any) =>
      this.mapToConversationResponse(conv),
    );
  }

  private async generateChatResponse(
    conversationContext: string[],
    promptHistory: string[],
  ): Promise<GeneratedPrompt[]> {
    const model = this.geminiService.getModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
      },
      systemInstruction: `
      You are an AI art generation assistant helping users refine and discover creative prompts.
      You have access to the user's recent prompt history and current conversation context.
      
      Your task is to:
      1. Understand the user's creative intent from their message
      2. Consider their past preferences from prompt history
      3. Generate 3 prompts that either:
         - Refine their current idea
         - Explore variations of their concept
         - Suggest new creative directions based on their interests
      
      Each prompt should be:
      - Clear and detailed (20-30 words)
      - Visually descriptive
      - Technically achievable with AI art generation
      - Diverse in style, mood, or perspective
      
      Output format: json array of 3 string prompts.
      Example: [prompt1, prompt2, ...]
    `,
    });

    const prompt = promptHistory.join('\n');

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();

      const parsed = JSON.parse(cleanedResponse);
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid response format');
      }

      return parsed;
    } catch (error) {
      console.error('Failed to generate chat response:', error);
      return this.generateFallbackPrompts();
    }
  }

  private async getConversationContext(
    conversationId: string,
  ): Promise<string[]> {
    const messages = await this.chatRepository.getConversationMessages(
      conversationId,
      this.CONVERSATION_CONTEXT_LIMIT,
    );

    return messages.map(
      (msg: { role: any; content: any }) => `${msg.role}: ${msg.content}`,
    );
  }

  private async getCachedUserPromptHistory(userId: string): Promise<string[]> {
    const cacheKey = `user_prompt_history:${userId}`;

    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached) {
      // this.logger.log(`Found cache userPromptHistory ${cached}`);
      return cached;
    }

    const prompts = await this.chatRepository.getRecentUserPrompts(
      userId,
      this.PROMPT_HISTORY_DAYS,
    );

    await this.cacheService.set(cacheKey, prompts, this.CACHE_TTL);

    return prompts;
  }

  private generateFallbackPrompts(): string[] {
    const styles = [
      'realistic',
      'abstract',
      'fantasy',
      'minimalist',
      'surreal',
    ];

    return styles;
  }

  private generateConversationTitle(firstMessage: string): string {
    // Simple title generation from first message
    const words = firstMessage.split(' ').slice(0, 5);
    return (
      words.join(' ') +
      (words.length < firstMessage.split(' ').length ? '...' : '')
    );
  }

  private mapToMessageResponse(
    message: any,
    generatedPrompts?: GeneratedPrompt[],
  ): MessageResponseDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      generatedPrompts:
        generatedPrompts || message.metadata?.generatedPrompts || [],
      createdAt: message.createdAt,
    };
  }

  private mapToConversationResponse(
    conversation: any,
  ): ConversationResponseDto {
    return {
      id: conversation.id,
      title: conversation.title,
      lastMessageAt: conversation.lastMessageAt,
      messages:
        conversation.messages?.map((msg: any) =>
          this.mapToMessageResponse(msg),
        ) || [],
    };
  }
}
