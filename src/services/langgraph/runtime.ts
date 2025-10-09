import { LangGraphChatEngine } from "./engine";

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export class LangGraphRuntime {
  private engine: LangGraphChatEngine;
  private messages: Message[] = [];

  constructor() {
    this.engine = new LangGraphChatEngine();
  }

  async processMessage(userMessage: string): Promise<Message> {
    // Add user message to history
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      createdAt: new Date()
    };
    this.messages.push(userMsg);

    try {
      // Process with LangGraph engine
      const responseContent = await this.engine.processMessage(userMessage);

      // Create assistant message
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        createdAt: new Date()
      };
      
      this.messages.push(assistantMsg);
      return assistantMsg;

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem.',
        createdAt: new Date()
      };
      this.messages.push(errorMsg);
      return errorMsg;
    }
  }

  getMessages(): Message[] {
    return this.messages;
  }

  clearMessages(): void {
    this.messages = [];
    this.engine.clearHistory();
  }

  getTools() {
    return this.engine.getTools();
  }
}