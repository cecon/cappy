/**
 * @fileoverview Main bootstrap orchestrator for Cappy extension
 * @module bootstrap/ExtensionBootstrap
 */

import * as vscode from 'vscode';
import { LanguageModelToolsBootstrap } from './LanguageModelToolsBootstrap';
import { ChatPanelWebviewProvider } from '../webview/ChatPanelWebviewProvider';
import { ProviderGateway } from '../../../../nivel2/infrastructure/providers/ProviderGateway';
import { SessionStore } from '../../../../nivel2/application/session/SessionStore';
import { PlanningModeEngine } from '../../../../nivel2/application/modes/PlanningModeEngine';
import { SandboxRuntime } from '../../../../nivel2/infrastructure/sandbox/SandboxRuntime';
import { AgentOrchestrator } from '../../../../nivel2/application/orchestrator/AgentOrchestrator';
import { OpenClaudeAdapter } from '../../../../nivel2/infrastructure/openclaude/OpenClaudeAdapter';
import type { ChatMode } from '../../../../shared/types/agent';

/**
 * Main bootstrap orchestrator for the extension
 */
export class ExtensionBootstrap {
  private webviewProvider: ChatPanelWebviewProvider | null = null;
  private providerGateway: ProviderGateway | null = null;
  private sessionStore: SessionStore | null = null;
  private orchestrator: AgentOrchestrator | null = null;
  private openClaudeAdapter: OpenClaudeAdapter | null = null;
  private featureEnableChatPanel = true;
  private featureEnableSandbox = true;
  private featureEnableOpenClaudeFallback = true;

  /**
   * Activates the extension
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('🚩 [Extension] Cappy activation starting...');
    console.log('Cappy extension is now active!');

    // Phase 1: Register Language Model Tools
    const lmToolsBootstrap = new LanguageModelToolsBootstrap();
    lmToolsBootstrap.register(context);

    // Phase 2: Build core architecture services
    this.setupArchitecture(context);

    // Phase 3: Register Chat Panel (sidebar webview)
    this.registerWebView(context);

    // Phase 4: Register extension commands/events
    this.registerCommands(context);

    console.log('✅ [Extension] Cappy activation completed');
  }

  /**
   * Initializes architecture services and orchestrator dependencies.
   */
  private setupArchitecture(context: vscode.ExtensionContext): void {
    const featureConfig = vscode.workspace.getConfiguration('cappy.features');
    this.featureEnableChatPanel = featureConfig.get<boolean>('enableChatPanel', true);
    this.featureEnableSandbox = featureConfig.get<boolean>('enableSandbox', true);
    this.featureEnableOpenClaudeFallback = featureConfig.get<boolean>('enableOpenClaudeFallback', true);

    this.providerGateway = new ProviderGateway(context.secrets);
    this.sessionStore = new SessionStore();
    const planningEngine = new PlanningModeEngine(this.providerGateway);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const sandboxRuntime = new SandboxRuntime(workspaceRoot ?? process.cwd());
    this.orchestrator = new AgentOrchestrator(this.sessionStore, planningEngine, sandboxRuntime);
    const openClaudeCommand = vscode.workspace.getConfiguration('cappy.openclaude').get<string>('command', 'openclaude');
    this.openClaudeAdapter = new OpenClaudeAdapter(openClaudeCommand);
  }

  /**
   * Register the Cappy sidebar WebView.
   */
  private registerWebView(context: vscode.ExtensionContext): void {
    if (!this.featureEnableChatPanel) {
      console.log('  ⚠️ Chat panel desabilitado por feature flag');
      return;
    }

    this.webviewProvider = new ChatPanelWebviewProvider(context.extensionUri);
    this.webviewProvider.setEvents({
      onReady: () => {
        void this.syncPanelState('Painel carregado.');
      },
      onCreateSession: (mode) => {
        if (!this.sessionStore) {
          return;
        }
        const session = this.sessionStore.createSession(mode);
        void this.syncPanelState(`Sessão criada: ${session.title}`, session.id);
      },
      onSendMessage: (data) => {
        void this.handleChatSend(data.sessionId, data.mode, data.prompt);
      },
      onSaveProvider: (data) => {
        void this.handleProviderSave(data.baseUrl, data.model, data.backend, data.apiKey);
      },
      onTestProvider: () => {
        void this.handleProviderTest();
      },
    });

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        ChatPanelWebviewProvider.viewType,
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
   * Registers extension commands.
   */
  private registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.diagnose', async () => {
        const out = vscode.window.createOutputChannel('Cappy Diagnose');
        out.clear();
        out.show(true);
        out.appendLine('Cappy Diagnose');
        out.appendLine(`Timestamp: ${new Date().toISOString()}`);
        out.appendLine('');
        const provider = this.providerGateway;
        if (!provider) {
          out.appendLine('Provider gateway não inicializado.');
          return;
        }
        const settings = await provider.getSettings();
        out.appendLine(`Backend: ${settings.backend}`);
        out.appendLine(`Base URL: ${settings.baseUrl}`);
        out.appendLine(`Model: ${settings.model}`);
        const test = await provider.testConnection();
        out.appendLine(`Test: ${test.ok ? 'OK' : 'FAIL'} - ${test.message}`);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.testLLM', async () => {
        await this.handleProviderTest();
      })
    );
  }

  /**
   * Deactivates the extension
   */
  async deactivate(): Promise<void> {
    console.log('👋 [Extension] Cappy deactivating...');
    console.log('✅ [Extension] Cappy deactivated');
  }

  /**
   * Gets internal state (for testing).
   */
  getState(): { orchestratorReady: boolean } {
    return {
      orchestratorReady: this.orchestrator !== null,
    };
  }

  /**
   * Handles one chat send event from webview.
   */
  private async handleChatSend(
    sessionId: string | undefined,
    mode: ChatMode,
    prompt: string,
  ): Promise<void> {
    if (!this.webviewProvider || !this.orchestrator || !this.providerGateway || !this.sessionStore) {
      return;
    }

    try {
      this.webviewProvider.updateStatus('Processando...');
      const settings = await this.providerGateway.getSettings();
      let responseText: string;
      let resolvedSessionId = sessionId;
      const effectiveMode: ChatMode = mode === 'sandbox' && !this.featureEnableSandbox ? 'planning' : mode;

      if (settings.backend === 'openclaude' && effectiveMode === 'planning' && this.openClaudeAdapter) {
        const session = this.sessionStore.getOrCreateSession(sessionId, effectiveMode);
        resolvedSessionId = session.id;
        this.sessionStore.appendMessage(session.id, { role: 'user', content: prompt, mode: effectiveMode });
        const available = await this.openClaudeAdapter.isAvailable();
        if (!available) {
          if (this.featureEnableOpenClaudeFallback) {
            const turn = await this.orchestrator.runTurn({ sessionId, mode: effectiveMode, prompt });
            responseText = turn.responseText;
            resolvedSessionId = turn.sessionId;
            await this.syncPanelState('OpenClaude indisponível, fallback aplicado.', resolvedSessionId);
            this.webviewProvider.startAssistantStream(resolvedSessionId);
            await this.streamText(resolvedSessionId, responseText);
            this.webviewProvider.endAssistantStream(resolvedSessionId);
            return;
          }
          throw new Error('OpenClaude externo indisponível. Verifique o comando configurado.');
        }
        responseText = await this.openClaudeAdapter.send(prompt);
        this.sessionStore.appendMessage(session.id, { role: 'assistant', content: responseText, mode: effectiveMode });
      } else {
        const turn = await this.orchestrator.runTurn({ sessionId, mode: effectiveMode, prompt });
        responseText = turn.responseText;
        resolvedSessionId = turn.sessionId;
      }

      await this.syncPanelState('Resposta gerada.', resolvedSessionId);
      if (!resolvedSessionId) {
        return;
      }
      this.webviewProvider.startAssistantStream(resolvedSessionId);
      await this.streamText(resolvedSessionId, responseText);
      this.webviewProvider.endAssistantStream(resolvedSessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.webviewProvider.updateStatus(`Erro: ${message}`);
      void vscode.window.showErrorMessage(`Cappy: ${message}`);
    }
  }

  /**
   * Streams assistant text to webview in small chunks.
   */
  private async streamText(sessionId: string, text: string): Promise<void> {
    if (!this.webviewProvider) {
      return;
    }
    const chunks = text.match(/.{1,80}/gs) ?? [text];
    for (const chunk of chunks) {
      this.webviewProvider.pushAssistantChunk(sessionId, chunk);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Saves provider configuration sent from the panel.
   */
  private async handleProviderSave(
    baseUrl: string,
    model: string,
    backend: 'openai' | 'openclaude',
    apiKey?: string,
  ): Promise<void> {
    if (!this.providerGateway) {
      return;
    }
    const config = vscode.workspace.getConfiguration('cappy.provider');
    await config.update('baseUrl', baseUrl, vscode.ConfigurationTarget.Global);
    await config.update('model', model, vscode.ConfigurationTarget.Global);
    await config.update('backend', backend, vscode.ConfigurationTarget.Global);
    if (apiKey && apiKey.trim().length > 0) {
      await this.providerGateway.setApiKey(apiKey.trim());
    }
    if (this.webviewProvider) {
      await this.syncPanelState('Provider salvo com sucesso.');
    }
  }

  /**
   * Executes provider test according to configured backend.
   */
  private async handleProviderTest(): Promise<void> {
    if (!this.providerGateway || !this.webviewProvider) {
      return;
    }
    const settings = await this.providerGateway.getSettings();
    if (settings.backend === 'openclaude' && this.openClaudeAdapter) {
      const available = await this.openClaudeAdapter.isAvailable();
      this.webviewProvider.updateStatus(
        available ? 'OpenClaude disponível.' : 'OpenClaude indisponível.',
      );
      return;
    }
    const result = await this.providerGateway.testConnection();
    this.webviewProvider.updateStatus(result.message);
  }

  /**
   * Syncs panel with current sessions and provider settings.
   */
  private async syncPanelState(statusText?: string, currentSessionId?: string): Promise<void> {
    if (!this.webviewProvider || !this.providerGateway || !this.sessionStore) {
      return;
    }
    const provider = await this.providerGateway.getSettings();
    const sessions = this.sessionStore.listSessions().map((session) => ({
      id: session.id,
      title: session.title,
      messages: session.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }));
    const selected = currentSessionId ?? sessions[0]?.id;
    this.webviewProvider.updateState({
      sessions,
      currentSessionId: selected,
      provider: {
        baseUrl: provider.baseUrl,
        model: provider.model,
        backend: provider.backend,
      },
      statusText,
    });
  }
}
