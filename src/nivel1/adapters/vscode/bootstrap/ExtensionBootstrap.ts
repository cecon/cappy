/**
 * @fileoverview Main bootstrap orchestrator for Cappy extension
 * @module bootstrap/ExtensionBootstrap
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { LanguageModelToolsBootstrap } from './LanguageModelToolsBootstrap';
import { ChatPanelWebviewProvider } from '../webview/ChatPanelWebviewProvider';
import { AuditTrailService } from '../../../../nivel2/application/audit/AuditTrailService';
import { ProviderGateway } from '../../../../nivel2/infrastructure/providers/ProviderGateway';
import { SessionStore } from '../../../../nivel2/application/session/SessionStore';
import { PlanningModeEngine } from '../../../../nivel2/application/modes/PlanningModeEngine';
import { SandboxRuntime } from '../../../../nivel2/infrastructure/sandbox/SandboxRuntime';
import { AgentOrchestrator } from '../../../../nivel2/application/orchestrator/AgentOrchestrator';
import { ToolBroker } from '../../../../nivel2/application/tools/ToolBroker';
import { JsonlAuditTrailStore } from '../../../../nivel2/infrastructure/audit/JsonlAuditTrailStore';
import { McpGateway } from '../../../../nivel2/infrastructure/mcp/McpGateway';
import { McpTransportAdapter } from '../../../../nivel2/infrastructure/mcp/McpTransportAdapter';
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
  private auditTrailService: AuditTrailService | null = null;
  private toolBroker: ToolBroker | null = null;
  private openClaudeAdapter: OpenClaudeAdapter | null = null;
  private featureEnableChatPanel = true;
  private featureEnableSandbox = true;
  private featureEnableOpenClaudeFallback = true;
  private rightSidebarMoveAttempted = false;
  private rightSidebarMoveSucceeded = false;

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
    await this.tryMoveCappyToRightSidebar();

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
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const resolvedWorkspaceRoot = workspaceRoot ?? process.cwd();
    this.auditTrailService = new AuditTrailService(new JsonlAuditTrailStore(resolvedWorkspaceRoot));
    const planningEngine = new PlanningModeEngine(this.providerGateway);
    const sandboxRuntime = new SandboxRuntime(resolvedWorkspaceRoot, this.auditTrailService);
    this.orchestrator = new AgentOrchestrator(this.sessionStore, planningEngine, sandboxRuntime, this.auditTrailService);
    const mcpGateway = new McpGateway(new McpTransportAdapter(), this.auditTrailService);
    this.toolBroker = new ToolBroker(mcpGateway, this.auditTrailService);
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
        void this.openDashboardOnRightSidebar();
      })
    );

    console.log('  ✅ Registered Cappy sidebar WebView');
  }

  /**
   * Opens Cappy dashboard preferring the right sidebar (auxiliary bar).
   */
  private async openDashboardOnRightSidebar(): Promise<void> {
    await this.tryMoveCappyToRightSidebar();
    await vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
    await vscode.commands.executeCommand('cappy.dashboard.focus');
  }

  /**
   * Tries to move Cappy view container to the right sidebar.
   * Falls back silently when commands are unavailable in the host.
   */
  private async tryMoveCappyToRightSidebar(): Promise<void> {
    if (this.rightSidebarMoveSucceeded || this.rightSidebarMoveAttempted) {
      return;
    }
    this.rightSidebarMoveAttempted = true;

    const containerId = 'workbench.view.extension.cappy-sidebar';
    const viewId = ChatPanelWebviewProvider.viewType;
    const attempts: Array<{ command: string; args: unknown[] }> = [
      { command: 'workbench.action.moveViewContainerToAuxiliaryBar', args: [containerId] },
      { command: 'workbench.action.moveViewContainerToAuxiliaryBar', args: [{ viewContainerId: containerId }] },
      { command: 'workbench.action.moveViewsToAuxiliaryBar', args: [[viewId]] },
      { command: 'workbench.action.moveViewsToAuxiliaryBar', args: [{ viewIds: [viewId] }] },
      { command: 'workbench.action.moveViewToSecondarySideBar', args: [viewId] },
      { command: 'workbench.action.moveViewToSecondarySideBar', args: [{ viewId }] },
    ];

    for (const attempt of attempts) {
      try {
        await vscode.commands.executeCommand(attempt.command, ...attempt.args);
        this.rightSidebarMoveSucceeded = true;
        break;
      } catch {
        // Ignore and try the next command/argument shape.
      }
    }
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
    await this.auditTrailService?.flush();
    console.log('👋 [Extension] Cappy deactivating...');
    console.log('✅ [Extension] Cappy deactivated');
  }

  /**
   * Gets internal state (for testing).
   */
  getState(): { orchestratorReady: boolean; toolBrokerReady: boolean } {
    return {
      orchestratorReady: this.orchestrator !== null,
      toolBrokerReady: this.toolBroker !== null,
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
      let resolvedRunId = `run-${crypto.randomUUID()}`;
      const effectiveMode: ChatMode = mode === 'sandbox' && !this.featureEnableSandbox ? 'planning' : mode;

      if (settings.backend === 'openclaude' && effectiveMode === 'planning' && this.openClaudeAdapter) {
        const session = this.sessionStore.getOrCreateSession(sessionId, effectiveMode);
        resolvedSessionId = session.id;
        resolvedRunId = `run-${crypto.randomUUID()}`;
        await this.auditTrailService?.appendIfNew({
          eventType: 'turn.started',
          sessionId: session.id,
          runId: resolvedRunId,
          actor: 'orchestrator',
          payloadRef: effectiveMode,
          attempt: 1,
        });
        this.sessionStore.appendMessage(session.id, { role: 'user', content: prompt, mode: effectiveMode });
        await this.auditTrailService?.appendIfNew({
          eventType: 'turn.user_appended',
          sessionId: session.id,
          runId: resolvedRunId,
          actor: 'orchestrator',
          payloadRef: effectiveMode,
          attempt: 1,
        });
        const available = await this.openClaudeAdapter.isAvailable();
        if (!available) {
          if (this.featureEnableOpenClaudeFallback) {
            const turn = await this.orchestrator.runTurn({ sessionId, mode: effectiveMode, prompt });
            responseText = turn.responseText;
            resolvedSessionId = turn.sessionId;
            resolvedRunId = turn.runId;
            await this.syncPanelState('OpenClaude indisponível, fallback aplicado.', resolvedSessionId);
            await this.streamText(resolvedSessionId, responseText, resolvedRunId);
            return;
          }
          throw new Error('OpenClaude externo indisponível. Verifique o comando configurado.');
        }
        responseText = await this.openClaudeAdapter.send(prompt);
        this.sessionStore.appendMessage(session.id, { role: 'assistant', content: responseText, mode: effectiveMode });
        await this.auditTrailService?.appendIfNew({
          eventType: 'turn.assistant_appended',
          sessionId: session.id,
          runId: resolvedRunId,
          actor: 'orchestrator',
          payloadRef: effectiveMode,
          attempt: 1,
        });
        await this.auditTrailService?.appendIfNew({
          eventType: 'turn.completed',
          sessionId: session.id,
          runId: resolvedRunId,
          actor: 'orchestrator',
          payloadRef: effectiveMode,
          attempt: 1,
        });
      } else {
        const turn = await this.orchestrator.runTurn({ sessionId, mode: effectiveMode, prompt });
        responseText = turn.responseText;
        resolvedSessionId = turn.sessionId;
        resolvedRunId = turn.runId;
      }

      await this.syncPanelState('Resposta gerada.', resolvedSessionId);
      if (!resolvedSessionId) {
        return;
      }
      await this.streamText(resolvedSessionId, responseText, resolvedRunId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.webviewProvider.updateStatus(`Erro: ${message}`);
      void vscode.window.showErrorMessage(`Cappy: ${message}`);
    }
  }

  /**
   * Streams assistant text to webview in small chunks.
   */
  private async streamText(sessionId: string, text: string, runId: string): Promise<void> {
    if (!this.webviewProvider) {
      return;
    }
    this.webviewProvider.startAssistantStream(sessionId);
    await this.auditTrailService?.appendIfNew({
      eventType: 'stream.started',
      sessionId,
      runId,
      actor: 'streaming-callback',
      payloadRef: 'assistant-stream',
      attempt: 1,
    });
    const chunks = text.match(/.{1,80}/gs) ?? [text];
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      this.webviewProvider.pushAssistantChunk(sessionId, chunk);
      await this.auditTrailService?.appendIfNew({
        eventType: 'stream.chunk',
        sessionId,
        runId,
        actor: 'streaming-callback',
        payloadRef: `chunk-${index + 1}`,
        attempt: 1,
        metadata: {
          size: chunk.length,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.webviewProvider.endAssistantStream(sessionId);
    await this.auditTrailService?.appendIfNew({
      eventType: 'stream.completed',
      sessionId,
      runId,
      actor: 'streaming-callback',
      payloadRef: 'assistant-stream',
      attempt: 1,
    });
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
