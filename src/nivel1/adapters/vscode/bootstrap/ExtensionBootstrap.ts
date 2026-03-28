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

import { CronScheduler } from '../../../../nivel2/infrastructure/scheduler/CronScheduler';

/**
 * Main bootstrap orchestrator for the extension
 */
export class ExtensionBootstrap {
  private readonly planningAgent = new IntelligentAgent();
  private bridge: CappyBridge | null = null;
  private webviewProvider: CappyWebViewProvider | null = null;
  private scheduler: CronScheduler | null = null;

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

    // Phase 6: Start Cron Scheduler
    this.startScheduler();

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

    // Use global storage for WhatsApp auth (shared across all workspaces/IDEs)
    const globalAuthDir = vscode.Uri.joinPath(context.globalStorageUri, 'whatsapp-auth').fsPath;

    // Migrate old workspace-local credentials to global storage (one-time)
    await this.migrateWhatsAppAuth(workspaceRoot, globalAuthDir);

    this.bridge = new CappyBridge(projectName, workspaceRoot, this.planningAgent, {
      globalAuthDir,
    });

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
      console.log(`[Bridge] WhatsApp auth dir (global): ${globalAuthDir}`);
    } catch (err) {
      console.error('[Bridge] Failed to start:', err);
    }
  }

  /**
   * Migrate WhatsApp auth from old workspace-local path to global storage.
   * This is a one-time operation — if global creds already exist, skip.
   */
  private async migrateWhatsAppAuth(workspaceRoot: string, globalAuthDir: string): Promise<void> {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const oldAuthDir = path.join(workspaceRoot, '.cappy', 'whatsapp-auth');
    const oldCredsFile = path.join(oldAuthDir, 'creds.json');
    const newCredsFile = path.join(globalAuthDir, 'creds.json');

    // Skip if no old credentials exist or global ones already exist
    if (!fs.existsSync(oldCredsFile) || fs.existsSync(newCredsFile)) {
      return;
    }

    console.log('[Bridge] Migrating WhatsApp credentials from workspace to global storage...');
    console.log(`[Bridge]   From: ${oldAuthDir}`);
    console.log(`[Bridge]   To:   ${globalAuthDir}`);

    try {
      // Ensure global auth directory exists
      if (!fs.existsSync(globalAuthDir)) {
        fs.mkdirSync(globalAuthDir, { recursive: true });
      }

      // Copy all auth files
      const files = fs.readdirSync(oldAuthDir);
      for (const file of files) {
        const srcPath = path.join(oldAuthDir, file);
        const destPath = path.join(globalAuthDir, file);
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
      }

      console.log(`[Bridge] ✅ Migrated ${files.length} auth files to global storage`);

      // Remove old workspace auth directory
      fs.rmSync(oldAuthDir, { recursive: true, force: true });
      console.log('[Bridge] Removed old workspace-local auth directory');
    } catch (err) {
      console.error('[Bridge] Migration failed (will continue with global dir):', err);
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

    // Test LLM — investigate Antigravity Custom Agents and Plugins
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.testLLM', async () => {
        const out = vscode.window.createOutputChannel('Cappy Test LLM');
        out.clear();
        out.show();

        out.appendLine('═══ CAPPY — CUSTOM AGENTS & PLUGINS ═══');
        out.appendLine(`Timestamp: ${new Date().toISOString()}`);
        out.appendLine('');

        // 1. getCascadePluginTemplate
        out.appendLine('── getCascadePluginTemplate ──');
        try {
          const template = await vscode.commands.executeCommand('antigravity.getCascadePluginTemplate');
          out.appendLine(`  type: ${typeof template}`);
          if (template) {
            out.appendLine(`  value: ${JSON.stringify(template, null, 2).substring(0, 2000)}`);
          } else {
            out.appendLine(`  value: ${template}`);
          }
        } catch (err) {
          out.appendLine(`  ❌ Error: ${err}`);
        }

        // 2. registerCustomAgentsProvider
        out.appendLine('');
        out.appendLine('── registerCustomAgentsProvider ──');
        const chat = vscode.chat as any;
        try {
          out.appendLine(`  typeof: ${typeof chat.registerCustomAgentsProvider}`);
          // Try registering with a simple provider
          const provider = {
            provideCustomAgents: () => {
              out.appendLine('  🔔 provideCustomAgents was called!');
              return [{
                id: 'cappy',
                name: 'Cappy',
                fullName: 'Cappy AI Assistant',
                description: 'WhatsApp-integrated AI assistant for remote development',
                isDefault: false,
                metadata: { isSticky: false }
              }];
            }
          };
          const disposable = chat.registerCustomAgentsProvider(provider);
          out.appendLine(`  ✅ Registered! disposable type: ${typeof disposable}`);
          if (disposable) {
            context.subscriptions.push(disposable);
          }
        } catch (err: any) {
          out.appendLine(`  ❌ Error: ${err?.message || err}`);
          // Try with different argument patterns
          try {
            const disposable = chat.registerCustomAgentsProvider('cappy', {
              provideCustomAgents: () => [{
                id: 'cappy',
                name: 'Cappy',
                description: 'AI Assistant via WhatsApp'
              }]
            });
            out.appendLine(`  ✅ Alt pattern worked! ${typeof disposable}`);
            if (disposable) context.subscriptions.push(disposable);
          } catch (err2: any) {
            out.appendLine(`  ❌ Alt pattern error: ${err2?.message || err2}`);
          }
        }

        // 3. createDynamicChatParticipant
        out.appendLine('');
        out.appendLine('── createDynamicChatParticipant ──');
        try {
          out.appendLine(`  typeof: ${typeof chat.createDynamicChatParticipant}`);
          const dynParticipant = chat.createDynamicChatParticipant(
            'cappy.dynamic',
            'Cappy',
            'WhatsApp AI assistant',
            async (request: any, context: any, response: any, token: any) => {
              out.appendLine('  🔔 Dynamic participant handler called!');
              out.appendLine(`    request type: ${typeof request}`);
              out.appendLine(`    request.model: ${request?.model ? 'EXISTS!' : 'null'}`);
              if (request?.model) {
                out.appendLine(`    model.name: ${request.model.name}`);
                out.appendLine(`    model.vendor: ${request.model.vendor}`);
                // Save the model!
                (globalThis as any).__cappyModel = request.model;
                out.appendLine('    ✅ MODEL CAPTURED!');
              }
              if (response?.markdown) {
                response.markdown('Olá! Cappy dynamic participant respondendo.');
              }
              return { metadata: { command: 'dynamic-test' } };
            }
          );
          out.appendLine(`  ✅ Created! type: ${typeof dynParticipant}`);
          if (dynParticipant) {
            if (typeof dynParticipant === 'object') {
              out.appendLine(`  keys: ${Object.keys(dynParticipant).join(', ')}`);
            }
            context.subscriptions.push(dynParticipant);
          }
        } catch (err: any) {
          out.appendLine(`  ❌ Error: ${err?.message || err}`);
          // Try different signatures
          try {
            const dp = chat.createDynamicChatParticipant(
              { id: 'cappy.dynamic', name: 'Cappy', description: 'AI via WhatsApp' },
              async (request: any) => {
                (globalThis as any).__cappyModel = request?.model;
                return {};
              }
            );
            out.appendLine(`  ✅ Alt pattern: ${typeof dp}`);
            if (dp) context.subscriptions.push(dp);
          } catch (err2: any) {
            out.appendLine(`  ❌ Alt pattern: ${err2?.message || err2}`);
          }
        }

        // 4. Check vscode.chat for ALL methods
        out.appendLine('');
        out.appendLine('── vscode.chat — ALL methods ──');
        for (const key of Object.keys(chat)) {
          out.appendLine(`  chat.${key} = ${typeof chat[key]}`);
        }

        // 5. Check if captured model exists now
        out.appendLine('');
        out.appendLine('── MODEL STATUS ──');
        const model = (globalThis as any).__cappyModel;
        out.appendLine(`  __cappyModel: ${model ? `${model.name} (${model.vendor})` : 'not captured yet'}`);

        // 6. Tools count
        out.appendLine('');
        out.appendLine('── TOOLS ──');
        out.appendLine(`  Total: ${vscode.lm.tools?.length ?? 0}`);

        out.appendLine('');
        out.appendLine('═══ FIM ═══');
        vscode.window.showInformationMessage('Cappy: Investigação Custom Agents completa!');
      })
    );

    // ── Scheduler Commands ──
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.scheduler.add', (data: any) => {
        if (!this.scheduler) return;
        const task = this.scheduler.addTask(data);
        vscode.window.showInformationMessage(`Cappy: Tarefa "${task.name}" agendada a cada ${task.intervalMinutes}min`);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.scheduler.toggle', (taskId: string) => {
        this.scheduler?.toggleTask(taskId);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.scheduler.remove', (taskId: string) => {
        this.scheduler?.removeTask(taskId);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.scheduler.run', async (taskId: string) => {
        if (!this.scheduler) return;
        vscode.window.showInformationMessage('Cappy: Executando tarefa agendada...');
        await this.scheduler.runNow(taskId);
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

          // Capture the model reference for use by the bridge/HITL
          (globalThis as any).__cappyModel = request.model;
          console.log(`[ChatParticipant] Model captured: ${request.model.name} (${request.model.vendor})`);

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
   * Start the Cron Scheduler for automated workflow execution
   */
  private startScheduler(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('[Scheduler] No workspace folder — scheduler not started');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    this.scheduler = new CronScheduler(workspaceRoot);

    // Wire bridge for WhatsApp notifications
    if (this.bridge) {
      this.scheduler.setBridge(this.bridge);
      this.bridge.setScheduler(this.scheduler);
    }

    // Wire scheduler events to webview
    if (this.webviewProvider) {
      this.scheduler.onTasksChanged((tasks) => {
        this.webviewProvider?.postMessage({ type: 'scheduler-tasks', data: tasks });
      });

      this.scheduler.onTaskRunning((taskId) => {
        this.webviewProvider?.postMessage({ type: 'scheduler-running', data: taskId });
      });

      this.scheduler.onTaskComplete((taskId, status) => {
        this.webviewProvider?.postMessage({ type: 'scheduler-complete', data: { taskId, status } });
      });
    }

    this.scheduler.start();
    console.log('  ✅ Cron Scheduler started');
  }

  /**
   * Deactivates the extension
   */
  async deactivate(): Promise<void> {
    console.log('👋 [Extension] Cappy deactivating...');
    this.scheduler?.stop();
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
