import * as vscode from 'vscode';

/**
 * Centralized LLM model selection service
 * Supports multiple models with fallback strategy
 */
export class LLMSelector {
  /**
   * Selects the best available language model based on user configuration:
   * 1. User's preferred model (from settings)
   * 2. Claude Sonnet 4.5 (if available)
   * 3. GPT-4o (Copilot)
   * 4. GPT-4 (Copilot)
   * 5. Any available Copilot model
   */
  static async selectBestModel(): Promise<vscode.LanguageModelChat | null> {
    try {
      // Get user preference from settings
      const config = vscode.workspace.getConfiguration('cappy.llm');
      const preferredModel = config.get<string>('preferredModel', 'auto');

      console.log(`🔍 LLM preference: ${preferredModel}`);

      // If user has a specific preference, try that first
      if (preferredModel !== 'auto') {
        const model = await this.selectModel(preferredModel);
        if (model) {
          return model;
        }
        console.log(`⚠️ Preferred model ${preferredModel} not available, using fallback`);
      }

      // Try Claude Sonnet 4.5 first (if user has it configured)
      let models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'claude-sonnet'
      });

      if (models.length > 0) {
        console.log('✅ Using Claude Sonnet 4.5');
        return models[0];
      }

      // Fallback to GPT-4o
      models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      });

      if (models.length > 0) {
        console.log('✅ Using GPT-4o');
        return models[0];
      }

      // Fallback to GPT-4
      models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4'
      });

      if (models.length > 0) {
        console.log('⚠️ Using GPT-4 (GPT-4o not available)');
        return models[0];
      }

      // Last resort: any Copilot model
      models = await vscode.lm.selectChatModels({
        vendor: 'copilot'
      });

      if (models.length > 0) {
        console.log(`⚠️ Using fallback model: ${models[0].name}`);
        return models[0];
      }

      console.warn('⚠️ No language models available');
      return null;

    } catch (error) {
      console.error('❌ Failed to select language model:', error);
      return null;
    }
  }

  /**
   * Selects a specific model by family name
   */
  static async selectModel(family: string): Promise<vscode.LanguageModelChat | null> {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family
      });

      if (models.length > 0) {
        console.log(`✅ Using ${family}`);
        return models[0];
      }

      console.warn(`⚠️ Model ${family} not available, using fallback`);
      return await this.selectBestModel();

    } catch (error) {
      console.error(`❌ Failed to select model ${family}:`, error);
      return await this.selectBestModel();
    }
  }
}
