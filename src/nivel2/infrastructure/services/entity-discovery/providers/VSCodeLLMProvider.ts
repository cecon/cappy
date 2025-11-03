import * as vscode from 'vscode';
import type { LLMProvider } from './LLMProvider';

/**
 * Adapter that implements LLMProvider using VS Code's Language Model API
 */
export class VSCodeLLMProvider implements LLMProvider {
  private model: vscode.LanguageModelChat | null = null;

  async initialize(): Promise<void> {
    try {
      // Try to get any available Copilot model, preferring gpt-4o but falling back to others
      let models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      });

      // Fallback to gpt-4 if gpt-4o is not available
      if (models.length === 0) {
        console.log('⚠️ gpt-4o not available, trying gpt-4...');
        models = await vscode.lm.selectChatModels({
          vendor: 'copilot',
          family: 'gpt-4'
        });
      }

      // Fallback to any Copilot model
      if (models.length === 0) {
        console.log('⚠️ gpt-4 not available, trying any Copilot model...');
        models = await vscode.lm.selectChatModels({
          vendor: 'copilot'
        });
      }

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
    } catch (error: unknown) {
      // Handle rate limiting gracefully
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('rate') || errorMsg.includes('limit') || errorMsg.includes('quota')) {
          console.warn('⚠️ Rate limit reached, skipping entity discovery for this chunk');
          return '{"entities": [], "relationships": []}'; // Return empty but valid response
        }
        
        // Handle unsupported model error
        if (errorMsg.includes('model is not supported')) {
          console.warn('⚠️ Model not supported, entity discovery will be disabled');
          return '{"entities": [], "relationships": []}';
        }
      }
      
      console.error('❌ LLM generation failed:', error);
      throw error;
    }
  }
}
