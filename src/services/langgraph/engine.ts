import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { terminalTool } from "../tools/terminal/terminalTool";
import langGraphConfig from "./config";

// Estado simplificado do chat
interface ChatState {
  messages: BaseMessage[];
  lastResponse?: string;
}

export class LangGraphChatEngine {
  private model: ChatOpenAI;
  private tools: any[];
  private conversationHistory: BaseMessage[] = [];

  constructor() {
    this.model = langGraphConfig.model as ChatOpenAI;
    this.tools = langGraphConfig.tools;
  }

  async processMessage(userMessage: string): Promise<string> {
    try {
      // Adicionar mensagem do usuário ao histórico
      const humanMessage = new HumanMessage(userMessage);
      this.conversationHistory.push(humanMessage);

      // Verificar se precisa usar tools
      const shouldUseTool = this.shouldUseTools(userMessage);
      
      if (shouldUseTool) {
        const modelWithTools = this.model.bindTools(this.tools);
        const response = await modelWithTools.invoke(this.conversationHistory);
        
        // Verificar se há tool calls na resposta
        if ('tool_calls' in response && response.tool_calls && response.tool_calls.length > 0) {
          const toolResults = await this.executeTools(response.tool_calls);
          this.conversationHistory.push(response);
          
          // Processar resultados das tools
          const finalResponse = await this.processFinalResponse(toolResults);
          this.conversationHistory.push(new AIMessage(finalResponse));
          return finalResponse;
        }
      }

      // Resposta normal sem tools
      const response = await this.model.invoke(this.conversationHistory);
      const responseContent = response.content?.toString() || 'Sem resposta';
      
      this.conversationHistory.push(new AIMessage(responseContent));
      return responseContent;

    } catch (error) {
      console.error('Erro no LangGraph Engine:', error);
      const errorMessage = 'Desculpe, ocorreu um erro ao processar sua mensagem.';
      this.conversationHistory.push(new AIMessage(errorMessage));
      return errorMessage;
    }
  }

  private shouldUseTools(message: string): boolean {
    const toolKeywords = ['executar', 'comando', 'terminal', 'run', 'execute'];
    return toolKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private async executeTools(toolCalls: any[]): Promise<any[]> {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        const tool = this.tools.find(t => t.name === toolCall.name);
        if (tool) {
          const result = await tool.invoke(toolCall.args);
          results.push({
            toolCallId: toolCall.id,
            output: result,
            toolName: toolCall.name
          });
        }
      } catch (error) {
        console.error(`Erro ao executar tool ${toolCall.name}:`, error);
        results.push({
          toolCallId: toolCall.id,
          output: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          toolName: toolCall.name
        });
      }
    }
    
    return results;
  }

  private async processFinalResponse(toolResults: any[]): Promise<string> {
    const resultsText = toolResults.map(result => 
      `Tool ${result.toolName}: ${result.output}`
    ).join('\n\n');
    
    const finalPrompt = new HumanMessage(
      `Com base nos resultados das ferramentas executadas:\n\n${resultsText}\n\nForneça uma resposta resumida e útil para o usuário.`
    );
    
    const finalResponse = await this.model.invoke([...this.conversationHistory, finalPrompt]);
    return finalResponse.content?.toString() || 'Ferramentas executadas com sucesso.';
  }

  getConversationHistory(): BaseMessage[] {
    return this.conversationHistory;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getTools() {
    return this.tools;
  }
}