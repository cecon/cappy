import * as vscode from 'vscode';
import type { LLMProvider } from './LLMProvider';

/**
 * Adapter that implements LLMProvider using VS Code's Language Model API
 */
export class VSCodeLLMProvider implements LLMProvider {
  private model: vscode.LanguageModelChat | null = null;

  async initialize(): Promise<void> {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      });

      if (models.length > 0) {
        this.model = models[0];
        console.log('✅ VSCodeLLMProvider initialized with model:', this.model.name);
      } else {
        console.warn('⚠️ No suitable language model found');
      }
    } catch (error) {
      console.error('❌ Failed to initialize VSCodeLLMProvider:', error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generate(prompt: string, _options?: Record<string, unknown>): Promise<string> {
    if (!this.model) {
      throw new Error('Language model not initialized. Call initialize() first.');
    }

    try {
      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      const response = await this.model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
      
      let result = '';
      for await (const chunk of response.text) {
        result += chunk;
      }

      return result;
    } catch (error) {
      console.error('❌ LLM generation failed:', error);
      throw error;
    }
  }
}
