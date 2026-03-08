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
import { setupAgentSkills } from '../../../../nivel2/infrastructure/agents/AgentSkillsSetup';

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
    console.log('Cappy extension is now active!');

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

    // Phase 6: Setup Agent Skills (creates/updates .agents/ in workspace)
    this.setupAgentSkills();

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
      console.log('[Bridge] No workspace folder — bridge not started');
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
          console.error('[Bridge] QR code generation failed:', err);
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
      console.log(`[Bridge] Started for project: ${projectName}`);
    } catch (err) {
      console.error('[Bridge] Failed to start:', err);
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
          vscode.window.showWarningMessage('Cappy: Bridge not running. Open a workspace first.');
          return;
        }
        await this.bridge.connectWhatsApp();
      })
    );

    // Show status
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.whatsapp.status', () => {
        if (!this.bridge) {
          vscode.window.showInformationMessage('Cappy: Bridge not running.');
          return;
        }
        const status = this.bridge.getStatus();
        vscode.window.showInformationMessage(
          `Cappy Bridge\n` +
          `Role: ${status.role?.toUpperCase()}\n` +
          `WhatsApp: ${status.whatsapp}\n` +
          `Projects: ${status.projects.join(', ')}`
        );
      })
    );

    // Reply to WhatsApp (used by AI assistant via /whatsapp-reply workflow)
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.whatsapp.reply', async (...args: any[]) => {
        if (!this.bridge) {
          vscode.window.showWarningMessage('Cappy: Bridge not running.');
          return;
        }

        // Accept text from command argument or prompt the user
        let replyText = args[0] as string | undefined;

        if (!replyText) {
          replyText = await vscode.window.showInputBox({
            prompt: 'Digite a resposta para o WhatsApp',
            placeHolder: 'Sua resposta aqui...',
          });
        }

        if (replyText) {
          await this.bridge.replyToWhatsApp(replyText);
        }
      })
    );

    // Diagnostic command — enumerate all available commands and test methods
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.diagnose', async () => {
        const out = vscode.window.createOutputChannel('Cappy Diagnose');
        out.clear();
        out.show();

        out.appendLine('═══ CAPPY DIAGNÓSTICO ═══');
        out.appendLine(`Timestamp: ${new Date().toISOString()}`);
        out.appendLine('');

        // 1. List ALL commands matching keywords
        out.appendLine('── COMANDOS DISPONÍVEIS ──');
        const allCommands = await vscode.commands.getCommands(true);
        const keywords = ['chat', 'antigravity', 'send', 'gemini', 'agent', 'copilot', 'ai'];
        for (const kw of keywords) {
          const matches = allCommands.filter((c: string) => c.toLowerCase().includes(kw));
          if (matches.length > 0) {
            out.appendLine(`\n[${kw}] (${matches.length} comandos):`);
            for (const cmd of matches.sort()) {
              out.appendLine(`  • ${cmd}`);
            }
          }
        }

        // 2. Test LLM availability
        out.appendLine('\n── MODELOS LLM ──');
        try {
          const models = await vscode.lm.selectChatModels();
          if (models && models.length > 0) {
            for (const m of models) {
              out.appendLine(`  ✅ ${m.name} (vendor: ${m.vendor}, family: ${m.family})`);
            }
          } else {
            out.appendLine('  ❌ Nenhum modelo disponível via vscode.lm.selectChatModels()');
          }
        } catch (err) {
          out.appendLine(`  ❌ Erro: ${err}`);
        }

        // 3. Test each injection method
        out.appendLine('\n── TESTES DE INJEÇÃO ──');
        const testQuery = '@cappy diagnóstico: esta é uma mensagem de teste do Cappy';

        // Test antigravity.sendTextToChat
        try {
          await vscode.commands.executeCommand('antigravity.sendTextToChat', true, testQuery);
          out.appendLine('  ✅ antigravity.sendTextToChat — executou sem erro');
        } catch (err) {
          out.appendLine(`  ❌ antigravity.sendTextToChat — ${err}`);
        }

        // Test workbench.action.chat.open
        try {
          await vscode.commands.executeCommand('workbench.action.chat.open', { query: testQuery });
          out.appendLine('  ✅ workbench.action.chat.open — executou sem erro');
        } catch (err) {
          out.appendLine(`  ❌ workbench.action.chat.open — ${err}`);
        }

        // Test other potential commands
        const chatCommands = allCommands.filter((c: string) => 
          c.includes('chat') && (c.includes('send') || c.includes('open') || c.includes('new') || c.includes('focus'))
        );
        out.appendLine(`\n── COMANDOS CHAT POTENCIAIS ──`);
        for (const cmd of chatCommands) {
          out.appendLine(`  📋 ${cmd}`);
        }

        out.appendLine('\n═══ FIM DO DIAGNÓSTICO ═══');
        vscode.window.showInformationMessage('Cappy: Diagnóstico completo! Veja o painel "Cappy Diagnose".');
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
   * Sets up agent skills in the workspace (.agents/ directory)
   */
  private setupAgentSkills(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('[AgentSkills] No workspace folder — skipped');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    try {
      setupAgentSkills(workspaceRoot);
    } catch (err) {
      console.error('[AgentSkills] Failed to setup:', err);
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
