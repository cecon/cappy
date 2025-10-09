import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import langGraphConfig from "./config.web";

export class LangGraphChatEngine {
  private model: ChatOpenAI;
  private conversationHistory: BaseMessage[] = [];

  constructor() {
    this.model = langGraphConfig.model as ChatOpenAI;
  }

  async processMessage(userMessage: string): Promise<string> {
    try {
      const humanMessage = new HumanMessage(userMessage);
      this.conversationHistory.push(humanMessage);

      const response = await this.model.invoke(this.conversationHistory);
      const responseContent = response.content?.toString() || 'Sem resposta';
      this.conversationHistory.push(new AIMessage(responseContent));
      return responseContent;
    } catch (error) {
      console.error('Erro no LangGraph Engine (web):', error);
      const errorMessage = 'Desculpe, ocorreu um erro ao processar sua mensagem.';
      this.conversationHistory.push(new AIMessage(errorMessage));
      return errorMessage;
    }
  }

  getConversationHistory(): BaseMessage[] {
    return this.conversationHistory;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getTools() {
    return [];
  }
}