/**
 * @fileoverview ExtensionBootstrap — thin activation orchestrator
 * @module bootstrap/ExtensionBootstrap
 *
 * Delegates each concern to a focused setup module:
 * - LanguageModelToolsBootstrap — LM tool registration
 * - BridgeSetup                — CappyBridge lifecycle
 * - SchedulerSetup             — CronScheduler lifecycle
 * - CommandSetup               — VS Code command registration
 */

import * as vscode from 'vscode';
import { LanguageModelToolsBootstrap }  from './LanguageModelToolsBootstrap';
import { BridgeSetup }                  from './setup/BridgeSetup';
import { SchedulerSetup }               from './setup/SchedulerSetup';
import { CommandSetup }                 from './setup/CommandSetup';
import { IntelligentAgent }             from '../../../../nivel2/infrastructure/agents';
import type { PlanningTurnResult }      from '../../../../nivel2/infrastructure/agents/common/types';
import { CappyWebViewProvider }         from '../webview/cappy-webview';
import { setupAgentSkills }             from '../../../../nivel2/infrastructure/agents/AgentSkillsSetup';

export class ExtensionBootstrap {
  private readonly planningAgent = new IntelligentAgent();

  async activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('[Extension] Cappy activation starting...');

    // 1 — LM tools (sync)
    new LanguageModelToolsBootstrap().register(context);

    // 2 — Chat participant (@cappy)
    this._registerChatParticipant(context);

    // 3 — Sidebar WebView
    const webviewProvider = this._registerWebView(context);

    // 4 — Bridge (async, auto-elects server/client)
    const bridge = await new BridgeSetup().start(context, this.planningAgent, webviewProvider);

    // 5 — Scheduler
    const scheduler = new SchedulerSetup().start(context, bridge, webviewProvider);

    // 6 — Commands
    new CommandSetup().register(context, bridge, scheduler);

    // 7 — Agent skills (.agents/ directory)
    this._setupAgentSkills();

    console.log('[Extension] Cappy activation completed');
  }

  async deactivate(): Promise<void> {
    console.log('[Extension] Cappy deactivating...');
  }

  // ── WebView ───────────────────────────────────────────────────────

  private _registerWebView(context: vscode.ExtensionContext): CappyWebViewProvider {
    const provider = new CappyWebViewProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(CappyWebViewProvider.viewType, provider)
    );
    return provider;
  }

  // ── Chat participant ──────────────────────────────────────────────

  private _registerChatParticipant(context: vscode.ExtensionContext): void {
    const participant = vscode.chat.createChatParticipant(
      'cappy.chat',
      async (
        request: vscode.ChatRequest,
        ctx: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken,
      ): Promise<vscode.ChatResult> => {
        try {
          const sessionId = ctx.history.length > 0
            ? `chat-${ctx.history[0].participant}`
            : 'chat-main';

          stream.progress('Pensando...');
          (globalThis as Record<string, unknown>)['__cappyModel'] = request.model;

          const { result } = await this.planningAgent.runSessionTurn({
            sessionId,
            message: request.prompt,
            model: request.model,
          });

          if (token.isCancellationRequested) {
            stream.markdown('\n\n_Cancelado pelo usuário_');
            return { metadata: { command: 'chat', cancelled: true } };
          }

          this._streamResult(stream, result);
          return { metadata: { command: 'chat', phase: result.phase } };
        } catch (error) {
          if (token.isCancellationRequested) {
            stream.markdown('\n\n_Cancelado pelo usuário_');
            return { metadata: { command: 'chat', cancelled: true } };
          }
          const msg = error instanceof Error ? error.message : String(error);
          stream.markdown(`\n\n⚠️ **Error**: ${msg}`);
          return { metadata: { command: 'chat', error: msg } };
        }
      }
    );

    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'assets', 'icon.png');
    context.subscriptions.push(participant);
  }

  private _streamResult(stream: vscode.ChatResponseStream, result: PlanningTurnResult): void {
    const last = result.conversationLog?.[result.conversationLog.length - 1];
    if (last?.content) stream.markdown(last.content);
  }

  // ── Agent skills ──────────────────────────────────────────────────

  private _setupAgentSkills(): void {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return;
    try { setupAgentSkills(root); }
    catch (err) { console.error('[AgentSkills] Failed to setup:', err); }
  }
}
