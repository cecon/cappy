/**
 * @fileoverview Main bootstrap orchestrator for Cappy extension
 * @module bootstrap/ExtensionBootstrap
 */

import * as vscode from 'vscode';
import { LanguageModelToolsBootstrap } from './LanguageModelToolsBootstrap';
import { IntelligentAgent } from '../../../../nivel2/infrastructure/agents';
import type { PlanningTurnResult } from '../../../../nivel2/infrastructure/agents/common/types';
import { CappyBridge } from '../../../../nivel2/infrastructure/bridge/cappy-bridge';
import { CappyWebViewProvider } from '../webview/cappy-webview';

/**
 * Main bootstrap orchestrator for the extension
 */
export class ExtensionBootstrap {
  private readonly planningAgent = new IntelligentAgent();
  private bridge: CappyBridge | null = null;
  private webviewProvider: CappyWebViewProvider | null = null;

  /**
   * Activates the extension
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('🚩 [Extension] Cappy activation starting...');
    console.log('🦫 Cappy extension is now active!');

    // Phase 1: Register Language Model Tools
    const lmToolsBootstrap = new LanguageModelToolsBootstrap();
    lmToolsBootstrap.register(context);

    // Phase 2: Register Chat Participant
    await this.registerChatParticipant(context);

    // Phase 3: Register WebView (sidebar panel)
    this.registerWebView(context);

    // Phase 4: Start Bridge (auto-elects as server or client)
    await this.startBridge(context);

    // Phase 5: Register WhatsApp commands
    this.registerBridgeCommands(context);

    console.log('✅ [Extension] Cappy activation completed');
  }

  /**
   * Register the Cappy sidebar WebView
   */
  private registerWebView(context: vscode.ExtensionContext): void {
    this.webviewProvider = new CappyWebViewProvider(context.extensionUri);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        CappyWebViewProvider.viewType,
        this.webviewProvider
      )
    );

    // Open dashboard command
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.openDashboard', () => {
        vscode.commands.executeCommand('cappy.dashboard.focus');
      })
    );

    console.log('  ✅ Registered Cappy sidebar WebView');
  }

  /**
   * Starts the Cappy Bridge for WhatsApp ↔ VS Code communication
   */
  private async startBridge(context: vscode.ExtensionContext): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('🦫 [Bridge] No workspace folder — bridge not started');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const projectName = workspaceFolders[0].name;

    this.bridge = new CappyBridge(projectName, workspaceRoot, this.planningAgent);

    // Wire bridge events to webview
    if (this.webviewProvider) {
      this.webviewProvider.setBridge(this.bridge);

      this.bridge.onQRCode(async (qr) => {
        try {
          const QRCode = await import('qrcode');
          const dataUri = await QRCode.toDataURL(qr, {
            width: 256,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
          });
          this.webviewProvider?.updateQRCode(dataUri);
        } catch (err) {
          console.error('🦫 [Bridge] QR code generation failed:', err);
          // Fallback: send raw text
          this.webviewProvider?.updateQRCode(qr);
        }
      });

      this.bridge.onStatusChange((status) => {
        this.webviewProvider?.updateStatus(status);
        if (status.whatsapp === 'connected') {
          this.webviewProvider?.clearQRCode();
        }
      });

      this.bridge.onMessage((from, text, direction) => {
        this.webviewProvider?.addMessage(from, text, direction);
      });
    }

    try {
      await this.bridge.start();
      console.log(`🦫 [Bridge] Started for project: ${projectName}`);
    } catch (err) {
      console.error('🦫 [Bridge] Failed to start:', err);
    }
  }

  /**
   * Registers VS Code commands for bridge control
   */
  private registerBridgeCommands(context: vscode.ExtensionContext): void {
    // Connect WhatsApp
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.whatsapp.connect', async () => {
        if (!this.bridge) {
          vscode.window.showWarningMessage('🦫 Cappy: Bridge not running. Open a workspace first.');
          return;
        }
        await this.bridge.connectWhatsApp();
      })
    );

    // Show status
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.whatsapp.status', () => {
        if (!this.bridge) {
          vscode.window.showInformationMessage('🦫 Cappy: Bridge not running.');
          return;
        }
        const status = this.bridge.getStatus();
        vscode.window.showInformationMessage(
          `🦫 Cappy Bridge\n` +
          `Role: ${status.role?.toUpperCase()}\n` +
          `WhatsApp: ${status.whatsapp}\n` +
          `Projects: ${status.projects.join(', ')}`
        );
      })
    );

    // Reply to WhatsApp from IDE chat
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.whatsapp.reply', async (text?: string) => {
        if (!this.bridge) {
          vscode.window.showWarningMessage('🦫 Cappy: Bridge not running.');
          return;
        }

        // If no text provided, ask for input
        if (!text) {
          text = await vscode.window.showInputBox({
            prompt: '🦫 Resposta para WhatsApp',
            placeHolder: 'Digite a resposta...',
          });
        }

        if (!text) return;

        const sent = this.bridge.sendWhatsAppReply(text);
        if (sent) {
          vscode.window.showInformationMessage(`🦫 Cappy: Resposta enviada ao WhatsApp!`);
        } else {
          vscode.window.showWarningMessage('🦫 Cappy: Nenhuma mensagem pendente do WhatsApp.');
        }
      })
    );
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
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
      ): Promise<vscode.ChatResult> => {
        try {
          const conversationId = context.history.length > 0 
            ? `chat-${context.history[0].participant}`
            : 'chat-main';
          
          stream.progress('Pensando...');

          const { result } = await this.planningAgent.runSessionTurn({
            sessionId: conversationId,
            message: request.prompt,
            model: request.model
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
    await this.bridge?.stop();
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
