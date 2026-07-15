import Groq from 'groq-sdk';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class GroqClient {
  private client: Groq;
  private defaultModel = 'llama-3.3-70b-versatile';

  constructor() {
    this.client = new Groq({
      apiKey: env.GROQ_API_KEY,
    });
  }

  /**
   * Generates a single string response.
   */
  async generateResponse(messages: ChatMessage[], model?: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        messages,
        model: model || this.defaultModel,
        temperature: 0.1, // Low temperature for grounded RAG
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Failed to generate response from Groq', { error });
      throw error;
    }
  }

  /**
   * Generates a streaming response.
   */
  async streamResponse(messages: ChatMessage[], model?: string) {
    try {
      const stream = await this.client.chat.completions.create({
        messages,
        model: model || this.defaultModel,
        temperature: 0.1,
        stream: true,
      });

      return stream;
    } catch (error) {
      logger.error('Failed to stream response from Groq', { error });
      throw error;
    }
  }
}

export const groqClient = new GroqClient();
