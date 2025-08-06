import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  getModel(config: {
    model: string;
    systemInstruction?: string;
  }): GenerativeModel {
    return this.genAI.getGenerativeModel(config);
  }

  async generateCanonicalPrompts(prompts: string[]): Promise<string[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = `
      You are a creative director for an AI art generation platform.
      Your task is to analyze a list of raw user prompts and come up with up creative prompts to help user explore new ideas.
      For each prompt, create one single, clear, and inspiring "canonical prompt".
      The user prompts are messy, but contain underlying popular ideas. You must group similar prompts together.
      For example, if you see "a dog on a skateboard," "dog skateboarding," and "a happy dog riding a skateboard," you should identify it as "A dog on a skateboard in a vibrant city park, detailed illustration."

      RULES:
      - Return ONLY a array of 5 strings.
      - The strings should be the final, beautiful, canonical prompts.
      - Do not include any explanation.
      - Example Output: ["Prompt 1", "Prompt 2", "Prompt 3", ...]
    `;

    const result = await model.generateContent([
      systemPrompt,
      `Here are the user prompts from the last few days: ${JSON.stringify(prompts)}`,
    ]);

    const responseText = result.response.text();

    try {
      const cleanedResponse = responseText.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      return [];
    }
  }
}
