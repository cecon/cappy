import * as vscode from 'vscode';

/**
 * Provider interface for Language Models
 */
export interface LanguageModelProvider {
  sendRequest(
    messages: vscode.LanguageModelChatMessage[],
    options?: Record<string, unknown>,
    token?: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatResponse>;
  
  vendor: string;
  family: string;
}
