/**
 * @fileoverview Main bootstrap orchestrator for Cappy extension (Simplified)
 * @module bootstrap/ExtensionBootstrap
 */

import * as vscode from 'vscode';
import { LanguageModelToolsBootstrap } from './LanguageModelToolsBootstrap';
import { IntelligentAgent } from '../../../../nivel2/infrastructure/agents';
import type { PlanningTurnResult } from '../../../../nivel2/infrastructure/agents/common/types';

/**
 * Main bootstrap orchestrator for the extension (Simplified)
 */
export class ExtensionBootstrap {
  private readonly planningAgent = new IntelligentAgent();

  /**
   * Activates the extension
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('🚩 [Extension] Cappy activation starting (Simplified Mode)...');
    console.log('🦫 Cappy extension is now active!');

    // Phase 1: Register Language Model Tools
    const lmToolsBootstrap = new LanguageModelToolsBootstrap();
    lmToolsBootstrap.register(context);

    // Phase 2: Register Chat Participant
    await this.registerChatParticipant(context);

    console.log('✅ [Extension] Cappy activation completed (Simplified Mode)');
  }

  /**
   * Registers the chat participant
   */
  private async registerChatParticipant(context: vscode.ExtensionContext): Promise<void> {
    console.log('💬 [ChatParticipant] Registering @cappy chat participant...');

    const participant = vscode.chat.createChatParticipant(
      'cappy.chat',
      async (
        request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
      ): Promise<vscode.ChatResult> => {
        try {
          const conversationId = `chat-${Date.now()}`;
          
          stream.progress('Pensando...');

          const { result } = await this.planningAgent.runSessionTurn({
            sessionId: conversationId,
            message: request.prompt
          });

          if (token.isCancellationRequested) {
            stream.markdown('\n\n_Cancelado pelo usuário_');
            return { metadata: { command: 'chat', cancelled: true } };
          }

          this.streamWorkflowResult(stream, result);

          return {
            metadata: {
              command: 'chat',
              phase: result.phase
            }
          };
        } catch (error) {
          if (token.isCancellationRequested) {
            stream.markdown('\n\n_Cancelado pelo usuário_');
            return { metadata: { command: 'chat', cancelled: true } };
          }

          const errMsg = error instanceof Error ? error.message : String(error);
          stream.markdown(`\n\n⚠️ **Error**: ${errMsg}`);
          console.error('[ChatParticipant] Error:', error);
          return { metadata: { command: 'chat', error: errMsg } };
        }
      }
    );

    // Set icon
    participant.iconPath = vscode.Uri.joinPath(
      context.extensionUri,
      'src',
      'assets',
      'icon.png'
    );

    context.subscriptions.push(participant);
    console.log('  ✅ Registered @cappy chat participant');
  }

  /**
   * Streams workflow result to chat
   */
  private streamWorkflowResult(
    stream: vscode.ChatResponseStream,
    result: PlanningTurnResult
  ): void {
    if (result.conversationLog) {
      const lastMessage = result.conversationLog[result.conversationLog.length - 1];
      if (lastMessage?.content) {
        stream.markdown(lastMessage.content);
      }
    }
  }

  /**
   * Deactivates the extension
   */
  async deactivate(): Promise<void> {
    console.log('👋 [Extension] Cappy deactivating...');
    console.log('✅ [Extension] Cappy deactivated');
  }

  /**
   * Gets internal state (for testing)
   */
  getState(): { planningAgent: IntelligentAgent } {
    return {
      planningAgent: this.planningAgent
    };
  }
}
