// Use a lighter web engine when bundling for the webview
// Fallback to Node engine in extension runtime if needed
let engineCtor: any;
try {
  // In bundling for web, prefer the web engine
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  engineCtor = require('./engine.web').LangGraphChatEngine;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  engineCtor = require('./engine').LangGraphChatEngine;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export class LangGraphRuntime {
  private readonly engine: InstanceType<typeof engineCtor>;
  private messages: Message[] = [];

  constructor() {
  this.engine = new engineCtor();
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