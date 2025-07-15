export class GeneratedPrompt {}

export class MessageResponseDto {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  generatedPrompts: string[];
  createdAt: Date;
}

export class ConversationResponseDto {
  id: string;
  title: string;
  lastMessageAt: Date;
  messages: MessageResponseDto[];
}
