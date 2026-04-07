/**
 * @fileoverview Main bootstrap orchestrator for Cappy extension
 * @module bootstrap/ExtensionBootstrap
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { LanguageModelToolsBootstrap } from './LanguageModelToolsBootstrap';
import { ChatPanelWebviewProvider } from '../webview/ChatPanelWebviewProvider';
import { CappyChatParticipant } from '../chat/CappyChatParticipant';
import { AuditTrailService } from '../../../../nivel2/application/audit/AuditTrailService';
import { ProviderGateway } from '../../../../nivel2/infrastructure/providers/ProviderGateway';
import { SessionStore, type SessionStoreSnapshot } from '../../../../nivel2/application/session/SessionStore';
import { PlanningModeEngine } from '../../../../nivel2/application/modes/PlanningModeEngine';
import { AgentModeEngine } from '../../../../nivel2/application/modes/AgentModeEngine';
import { SandboxRuntime } from '../../../../nivel2/infrastructure/sandbox/SandboxRuntime';
import { AgentOrchestrator } from '../../../../nivel2/application/orchestrator/AgentOrchestrator';
import { ToolBroker } from '../../../../nivel2/application/tools/ToolBroker';
import { JsonlAuditTrailStore } from '../../../../nivel2/infrastructure/audit/JsonlAuditTrailStore';
import { McpGateway } from '../../../../nivel2/infrastructure/mcp/McpGateway';
import { McpTransportAdapter } from '../../../../nivel2/infrastructure/mcp/McpTransportAdapter';
import { OpenClaudeAdapter } from '../../../../nivel2/infrastructure/openclaude/OpenClaudeAdapter';
import type { ChatMode, ChatSession } from '../../../../shared/types/agent';

/**
 * Main bootstrap orchestrator for the extension
 */
export class ExtensionBootstrap {
  private static readonly SESSION_SNAPSHOT_KEY = 'cappy.chat.sessions.v1';
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
  private currentSessionId: string | undefined;
  private currentUIMode: 'agent' | 'plan' | 'debug' | 'ask' | 'sandbox' = 'plan';
  private activeStreamingSessionId: string | undefined;
  private stoppedStreamingSessions = new Set<string>();
  private extensionContext: vscode.ExtensionContext | null = null;

  /**
   * Activates the extension
   */
  async activate(context: vscode.ExtensionContext): Promise<void> {
    this.extensionContext = context;
    console.log('🚩 [Extension] Cappy activation starting...');
    console.log('Cappy extension is now active!');

    // Phase 1: Register Language Model Tools
    const lmToolsBootstrap = new LanguageModelToolsBootstrap();
    lmToolsBootstrap.register(context);

    // Phase 2: Build core architecture services
    this.setupArchitecture(context);

    // Phase 2.1: Register native chat participant
    this.registerNativeChatParticipant(context);

    // Phase 3: Register Chat Panel (sidebar webview)
    this.registerWebView(context);
    await this.tryMoveCappyToRightSidebar();

    // Phase 4: Register extension commands/events
    this.registerCommands(context);

    console.log('✅ [Extension] Cappy activation completed');
  }

  /**
   * Registers native @cappy chat participant when host API is available.
   */
  private registerNativeChatParticipant(context: vscode.ExtensionContext): void {
    const participant = new CappyChatParticipant({
      onRequest: async (request) => {
        const mode = this.resolveModeFromParticipantCommand(request.command);
        const prompt = request.prompt.trim().length > 0
          ? request.prompt
          : this.defaultPromptForCommand(request.command);
        const session = this.sessionStore?.getOrCreateSession(this.currentSessionId, mode);
        const sessionId = session?.id;
        const turn = await this.runTurnAndSync({
          prompt,
          mode,
          sessionId,
          preferNativeToolEvents: true,
        });
        return {
          text: turn.responseText,
          sessionId: turn.sessionId,
          toolCalls: turn.toolCalls ?? [],
        };
      },
    });
    participant.register(context);
  }

  /**
   * Maps participant command aliases into runtime mode.
   */
  private resolveModeFromParticipantCommand(command: string | undefined): ChatMode {
    const lower = (command ?? '').toLowerCase();
    if (lower.includes('agent')) {
      this.currentUIMode = 'agent';
      return 'agent';
    }
    if (lower.includes('debug')) {
      this.currentUIMode = 'debug';
      return 'sandbox';
    }
    if (lower.includes('ask')) {
      this.currentUIMode = 'ask';
      return 'planning';
    }
    this.currentUIMode = 'plan';
    return 'planning';
  }

  /**
   * Generates fallback prompt when command is used without text.
   */
  private defaultPromptForCommand(command: string | undefined): string {
    const lower = (command ?? '').toLowerCase();
    if (lower.includes('help')) {
      return 'Explique rapidamente como usar os modos Plan, Agent, Debug e Ask no Cappy.';
    }
    if (lower.includes('agent')) {
      return 'Execute como Agent e proponha os próximos passos práticos.';
    }
    if (lower.includes('debug')) {
      return 'Rode uma estratégia de diagnóstico e validação para a tarefa atual.';
    }
    if (lower.includes('ask')) {
      return 'Responda de forma curta e objetiva.';
    }
    return 'Crie um plano objetivo para a solicitação atual.';
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
    const snapshot = context.workspaceState.get<SessionStoreSnapshot>(
      ExtensionBootstrap.SESSION_SNAPSHOT_KEY,
    );
    this.sessionStore.restoreFromSnapshot(snapshot);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const resolvedWorkspaceRoot = workspaceRoot ?? process.cwd();
    this.auditTrailService = new AuditTrailService(new JsonlAuditTrailStore(resolvedWorkspaceRoot));
    const planningEngine = new PlanningModeEngine(this.providerGateway);
    const sandboxRuntime = new SandboxRuntime(resolvedWorkspaceRoot, this.auditTrailService);
    const mcpGateway = new McpGateway(new McpTransportAdapter(), this.auditTrailService);
    this.toolBroker = new ToolBroker(mcpGateway, this.auditTrailService);
    const agentMode = new AgentModeEngine(this.providerGateway, this.toolBroker);
    this.orchestrator = new AgentOrchestrator(
      this.sessionStore,
      planningEngine,
      sandboxRuntime,
      agentMode,
      this.auditTrailService,
    );
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
        void this.syncPanelState('Painel carregado.', this.currentSessionId);
      },
      onCreateSession: (mode) => {
        if (!this.sessionStore) {
          return;
        }
        const session = this.sessionStore.createSession(mode);
        this.currentSessionId = session.id;
        void this.persistSessions();
        void this.syncPanelState(`Sessão criada: ${session.title}`, session.id);
      },
      onSendMessage: (data) => {
        if (data.uiMode === 'agent' || data.uiMode === 'plan' || data.uiMode === 'debug' || data.uiMode === 'ask' || data.uiMode === 'sandbox') {
          this.currentUIMode = data.uiMode;
        }
        void this.handleChatSend(data.sessionId, data.mode, data.prompt);
      },
      onSaveProvider: (data) => {
        void this.handleProviderSave(data.baseUrl, data.model, data.backend, data.apiKey, data.token);
      },
      onTestProvider: () => {
        void this.handleProviderTest();
      },
      onSelectSession: (sessionId) => {
        this.currentSessionId = sessionId;
        void this.syncPanelState(undefined, sessionId);
      },
      onRenameSession: (data) => {
        if (!this.sessionStore) {
          return;
        }
        this.sessionStore.renameSession(data.sessionId, data.title);
        this.currentSessionId = data.sessionId;
        void this.persistSessions();
        void this.syncPanelState('Sessão renomeada.', data.sessionId);
      },
      onTogglePinSession: (sessionId) => {
        if (!this.sessionStore) {
          return;
        }
        this.sessionStore.togglePin(sessionId);
        this.currentSessionId = sessionId;
        void this.persistSessions();
        void this.syncPanelState('Sessão atualizada.', sessionId);
      },
      onArchiveSession: (data) => {
        if (!this.sessionStore) {
          return;
        }
        this.sessionStore.setArchived(data.sessionId, data.archived);
        this.currentSessionId = data.sessionId;
        void this.persistSessions();
        void this.syncPanelState(
          data.archived ? 'Sessão arquivada.' : 'Sessão reativada.',
          data.sessionId,
        );
      },
      onDeleteSession: (sessionId) => {
        if (!this.sessionStore) {
          return;
        }
        this.sessionStore.deleteSession(sessionId);
        this.currentSessionId = this.sessionStore.listSessions()[0]?.id;
        void this.persistSessions();
        void this.syncPanelState('Sessão removida.', this.currentSessionId);
      },
      onStopStream: (sessionId) => {
        if (!sessionId) {
          return;
        }
        this.stoppedStreamingSessions.add(sessionId);
        this.webviewProvider?.updateStatus('Interrompendo streaming...');
      },
      onExportSession: (sessionId) => {
        void this.exportSession(sessionId);
      },
      onMaximizePanel: () => {
        void this.openDashboardOnRightSidebar();
      },
      onMovePanel: () => {
        void this.tryMoveCappyToRightSidebar();
      },
      onOpenSettings: () => {
        void vscode.commands.executeCommand('workbench.action.openSettings', 'cappy');
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
    await this.persistSessions();
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
    try {
      const turn = await this.runTurnAndSync({
        prompt,
        mode,
        sessionId,
      });
      if (!turn.sessionId) {
        return;
      }
      await this.streamText(turn.sessionId, turn.responseText, turn.runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.currentSessionId) {
        this.webviewProvider?.postMessage({
          type: 'tool-call',
          data: {
            sessionId: this.currentSessionId,
            tool: 'sandbox-runtime',
            status: 'error',
            output: message,
          },
        });
      }
      this.webviewProvider?.updateStatus(`Erro: ${message}`);
      void vscode.window.showErrorMessage(`Cappy: ${message}`);
    }
  }

  /**
   * Executes one turn and synchronizes session state for all surfaces.
   */
  private async runTurnAndSync(params: {
    prompt: string;
    mode: ChatMode;
    sessionId?: string;
    preferNativeToolEvents?: boolean;
  }): Promise<{ sessionId: string; runId: string; responseText: string; toolCalls?: Array<{ tool: string; status: 'running' | 'done' | 'error'; input?: string; output?: string }> }> {
    if (!this.orchestrator || !this.providerGateway || !this.sessionStore) {
      throw new Error('Orquestrador indisponível.');
    }
    this.webviewProvider?.updateStatus('Processando...');
    const settings = await this.providerGateway.getSettings();
    let responseText: string;
    let resolvedSessionId = params.sessionId;
    let resolvedRunId = `run-${crypto.randomUUID()}`;
    let toolCalls: Array<{ tool: string; status: 'running' | 'done' | 'error'; input?: string; output?: string }> | undefined;
    const requiresSandbox = params.mode === 'sandbox' || params.mode === 'agent';
    const effectiveMode: ChatMode = requiresSandbox && !this.featureEnableSandbox ? 'planning' : params.mode;

    if (settings.backend === 'openclaude' && effectiveMode === 'planning' && this.openClaudeAdapter) {
      const session = this.sessionStore.getOrCreateSession(params.sessionId, effectiveMode);
      resolvedSessionId = session.id;
      this.currentSessionId = session.id;
      resolvedRunId = `run-${crypto.randomUUID()}`;
      await this.auditTrailService?.appendIfNew({
        eventType: 'turn.started',
        sessionId: session.id,
        runId: resolvedRunId,
        actor: 'orchestrator',
        payloadRef: effectiveMode,
        attempt: 1,
      });
      this.sessionStore.appendMessage(session.id, { role: 'user', content: params.prompt, mode: effectiveMode });
      await this.persistSessions();
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
          const fallback = await this.orchestrator.runTurn({
            sessionId: params.sessionId,
            mode: effectiveMode,
            prompt: params.prompt,
          });
          responseText = fallback.responseText;
          resolvedSessionId = fallback.sessionId;
          resolvedRunId = fallback.runId;
          toolCalls = fallback.toolCalls;
        } else {
          throw new Error('OpenClaude externo indisponível. Verifique o comando configurado.');
        }
      } else {
        responseText = await this.openClaudeAdapter.send(params.prompt);
        this.sessionStore.appendMessage(session.id, { role: 'assistant', content: responseText, mode: effectiveMode });
        await this.persistSessions();
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
      }
    } else {
      const turn = await this.orchestrator.runTurn({
        sessionId: resolvedSessionId ?? params.sessionId,
        mode: effectiveMode,
        prompt: params.prompt,
      });
      responseText = turn.responseText;
      resolvedSessionId = turn.sessionId;
      resolvedRunId = turn.runId;
      toolCalls = turn.toolCalls;
      this.currentSessionId = turn.sessionId;
    }

    if (!resolvedSessionId) {
      throw new Error('Falha ao resolver sessão ativa.');
    }

    if (!params.preferNativeToolEvents && toolCalls?.length) {
      for (const toolCall of toolCalls) {
        this.webviewProvider?.postMessage({
          type: 'tool-call',
          data: {
            sessionId: resolvedSessionId,
            ...toolCall,
          },
        });
      }
    }

    await this.syncPanelState('Resposta gerada.', resolvedSessionId);
    await this.persistSessions();

    return {
      sessionId: resolvedSessionId,
      runId: resolvedRunId,
      responseText: responseText!,
      toolCalls,
    };
  }

  /**
   * Streams assistant text to webview in small chunks.
   */
  private async streamText(sessionId: string, text: string, runId: string): Promise<void> {
    if (!this.webviewProvider) {
      return;
    }
    this.activeStreamingSessionId = sessionId;
    this.stoppedStreamingSessions.delete(sessionId);
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
      if (this.stoppedStreamingSessions.has(sessionId)) {
        break;
      }
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
    const wasStopped = this.stoppedStreamingSessions.has(sessionId);
    this.stoppedStreamingSessions.delete(sessionId);
    this.activeStreamingSessionId = undefined;
    await this.auditTrailService?.appendIfNew({
      eventType: 'stream.completed',
      sessionId,
      runId,
      actor: 'streaming-callback',
      payloadRef: 'assistant-stream',
      attempt: 1,
    });
    this.webviewProvider?.updateStatus(wasStopped ? 'Streaming interrompido.' : 'Pronto.');
    await this.syncPanelState(undefined, sessionId);
  }

  /**
   * Saves provider configuration sent from the panel.
   */
  private async handleProviderSave(
    baseUrl: string,
    model: string,
    backend: 'openai' | 'openclaude',
    apiKey?: string,
    token?: string,
  ): Promise<void> {
    if (!this.providerGateway) {
      return;
    }
    const config = vscode.workspace.getConfiguration('cappy.provider');
    await config.update('baseUrl', baseUrl, vscode.ConfigurationTarget.Global);
    await config.update('model', model, vscode.ConfigurationTarget.Global);
    await config.update('backend', backend, vscode.ConfigurationTarget.Global);
    const nextApiKey = apiKey?.trim() || token?.trim();
    if (nextApiKey && nextApiKey.length > 0) {
      await this.providerGateway.setApiKey(nextApiKey);
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
      this.webviewProvider?.updateStatus(
        available ? 'OpenClaude disponível.' : 'OpenClaude indisponível.',
      );
      return;
    }
    const result = await this.providerGateway.testConnection();
    this.webviewProvider?.updateStatus(result.message);
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
      mode: session.mode,
      status: session.status,
      pinned: session.pinned,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        mode: message.mode,
        toolCall: message.role === 'tool'
          ? this.tryParseToolCallContent(message.content)
          : undefined,
      })),
    }));
    const selected = currentSessionId ?? this.currentSessionId ?? sessions[0]?.id;
    this.currentSessionId = selected;
    const aggregateChars = sessions
      .flatMap((item) => item.messages)
      .reduce((sum, message) => sum + message.content.length, 0);
    const usage = Math.max(1, Math.round(aggregateChars / 4));
    this.webviewProvider.updateState({
      sessions,
      currentSessionId: selected,
      provider: {
        baseUrl: provider.baseUrl,
        model: provider.model,
        backend: provider.backend,
      },
      statusText,
      isStreaming: this.activeStreamingSessionId === selected,
      currentUIMode: this.currentUIMode,
      contextUsage: {
        used: usage,
        limit: 32768,
      },
    });
  }

  /**
   * Persists serialized sessions in workspaceState.
   */
  private async persistSessions(): Promise<void> {
    if (!this.extensionContext || !this.sessionStore) {
      return;
    }
    await this.extensionContext.workspaceState.update(
      ExtensionBootstrap.SESSION_SNAPSHOT_KEY,
      this.sessionStore.createSnapshot(),
    );
  }

  /**
   * Exports a single session to markdown file.
   */
  private async exportSession(sessionId?: string): Promise<void> {
    if (!this.sessionStore) {
      return;
    }
    const selected = sessionId ?? this.currentSessionId;
    if (!selected) {
      this.webviewProvider?.updateStatus('Nenhuma sessão selecionada para exportar.');
      return;
    }
    const session = this.sessionStore.getSession(selected);
    if (!session) {
      this.webviewProvider?.updateStatus('Sessão não encontrada para exportação.');
      return;
    }
    const defaultUri = vscode.Uri.file(
      `${(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd())}\\${this.slugifySessionTitle(session)}.md`,
    );
    const target = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        Markdown: ['md'],
      },
      saveLabel: 'Exportar sessão',
    });
    if (!target) {
      return;
    }
    const markdown = this.buildSessionMarkdown(session);
    await vscode.workspace.fs.writeFile(target, Buffer.from(markdown, 'utf8'));
    this.webviewProvider?.updateStatus(`Sessão exportada: ${target.fsPath}`);
  }

  /**
   * Builds markdown report for one chat session.
   */
  private buildSessionMarkdown(session: ChatSession): string {
    const lines = [
      `# ${session.title}`,
      '',
      `- ID: ${session.id}`,
      `- Modo: ${session.mode}`,
      `- Status: ${session.status}`,
      `- Criada em: ${session.createdAt}`,
      `- Atualizada em: ${session.updatedAt}`,
      '',
      '---',
      '',
    ];
    for (const message of session.messages) {
      lines.push(`## ${message.role.toUpperCase()} (${message.createdAt})`);
      lines.push('');
      lines.push(message.content);
      lines.push('');
    }
    return lines.join('\n');
  }

  /**
   * Creates a file-safe name for export operations.
   */
  private slugifySessionTitle(session: ChatSession): string {
    const fallback = `cappy-session-${session.id}`;
    const normalized = session.title
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    return normalized.length > 0 ? normalized : fallback;
  }

  /**
   * Parses serialized tool payload from timeline message content.
   */
  private tryParseToolCallContent(content: string): {
    tool: string;
    status: 'running' | 'done' | 'error';
    input?: string;
    output?: string;
  } | undefined {
    try {
      const parsed = JSON.parse(content) as {
        tool?: string;
        status?: string;
        input?: string;
        output?: string;
      };
      if (!parsed.tool || !parsed.status) {
        return undefined;
      }
      if (parsed.status !== 'running' && parsed.status !== 'done' && parsed.status !== 'error') {
        return undefined;
      }
      return {
        tool: parsed.tool,
        status: parsed.status,
        input: parsed.input,
        output: parsed.output,
      };
    } catch {
      return undefined;
    }
  }
}
