import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { ChatOpenAI } from "@langchain/openai";
import { terminalTool } from "../tools/terminal/terminalTool";

export interface LangGraphConfig {
  model?: BaseLanguageModel;
  tools?: any[];
}

export class LangGraphAdapter {
  private model: BaseLanguageModel;
  private tools: any[];

  constructor(config: LangGraphConfig = {}) {
    this.model = config.model || new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
    });
    
    this.tools = config.tools || [terminalTool];
  }

  async processMessage(message: string): Promise<string> {
    try {
      // Aqui será implementada a lógica do LangGraph
      // Por enquanto, uma implementação simples
      const response = await this.model.invoke(message);
      return typeof response === 'string' ? response : response.content || 'Sem resposta';
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      return 'Desculpe, ocorreu um erro ao processar sua mensagem.';
    }
  }

  getTools() {
    return this.tools;
  }
}