/**
 * @fileoverview CommandSetup — registers all VS Code commands for Cappy
 * @module bootstrap/setup/CommandSetup
 */

import * as vscode from 'vscode';
import { CappyBridge }    from '../../../../../nivel2/infrastructure/bridge/cappy-bridge';
import { CronScheduler }  from '../../../../../nivel2/infrastructure/scheduler/CronScheduler';

export class CommandSetup {
  register(
    context: vscode.ExtensionContext,
    bridge: CappyBridge | null,
    scheduler: CronScheduler | null,
  ): void {
    this._bridgeCommands(context, bridge);
    this._schedulerCommands(context, scheduler);
    this._diagnosticCommands(context, bridge);
  }

  // ── Bridge commands ───────────────────────────────────────────────

  private _bridgeCommands(context: vscode.ExtensionContext, bridge: CappyBridge | null): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.openDashboard', () => {
        vscode.commands.executeCommand('cappy.dashboard.focus');
      }),

      vscode.commands.registerCommand('cappy.whatsapp.connect', async () => {
        if (!bridge) { vscode.window.showWarningMessage('Cappy: Bridge not running. Open a workspace first.'); return; }
        await bridge.connectWhatsApp();
      }),

      vscode.commands.registerCommand('cappy.whatsapp.status', () => {
        if (!bridge) { vscode.window.showInformationMessage('Cappy: Bridge not running.'); return; }
        const s = bridge.getStatus();
        vscode.window.showInformationMessage(
          `Cappy Bridge\nRole: ${s.role?.toUpperCase()}\nWhatsApp: ${s.whatsapp}\nProjects: ${s.projects.join(', ')}`
        );
      }),

      vscode.commands.registerCommand('cappy.whatsapp.reply', async (...args: unknown[]) => {
        if (!bridge) { vscode.window.showWarningMessage('Cappy: Bridge not running.'); return; }
        let text = args[0] as string | undefined;
        if (!text) {
          text = await vscode.window.showInputBox({ prompt: 'Digite a resposta para o WhatsApp', placeHolder: 'Sua resposta aqui...' });
        }
        if (text) await bridge.replyToWhatsApp(text);
      }),
    );
  }

  // ── Scheduler commands ────────────────────────────────────────────

  private _schedulerCommands(context: vscode.ExtensionContext, scheduler: CronScheduler | null): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.scheduler.add', (data: unknown) => {
        if (!scheduler) return;
        const task = scheduler.addTask(data as Record<string, unknown>);
        vscode.window.showInformationMessage(`Cappy: Tarefa "${task.name}" agendada a cada ${task.intervalMinutes}min`);
      }),
      vscode.commands.registerCommand('cappy.scheduler.toggle', (id: string) => { scheduler?.toggleTask(id); }),
      vscode.commands.registerCommand('cappy.scheduler.remove', (id: string) => { scheduler?.removeTask(id); }),
      vscode.commands.registerCommand('cappy.scheduler.run', async (id: string) => {
        if (!scheduler) return;
        vscode.window.showInformationMessage('Cappy: Executando tarefa agendada...');
        await scheduler.runNow(id);
      }),
    );
  }

  // ── Diagnostic commands ───────────────────────────────────────────

  private _diagnosticCommands(context: vscode.ExtensionContext, _bridge: CappyBridge | null): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('cappy.diagnose', async () => {
        const out = vscode.window.createOutputChannel('Cappy Diagnose');
        out.clear(); out.show();
        out.appendLine('═══ CAPPY DIAGNÓSTICO ═══');
        out.appendLine(`Timestamp: ${new Date().toISOString()}`);

        const all = await vscode.commands.getCommands(true);
        for (const kw of ['chat', 'antigravity', 'send', 'gemini', 'agent', 'copilot', 'ai']) {
          const matches = all.filter((c: string) => c.toLowerCase().includes(kw));
          if (matches.length > 0) {
            out.appendLine(`\n[${kw}]:`);
            matches.sort().forEach((c: string) => out.appendLine(`  • ${c}`));
          }
        }

        out.appendLine('\n── MODELOS LLM ──');
        try {
          const models = await vscode.lm.selectChatModels();
          if (models?.length) {
            models.forEach(m => out.appendLine(`  ✅ ${m.name} (${m.vendor})`));
          } else {
            out.appendLine('  ❌ Nenhum modelo disponível');
          }
        } catch (err) { out.appendLine(`  ❌ ${err}`); }

        out.appendLine('\n═══ FIM ═══');
        vscode.window.showInformationMessage('Cappy: Diagnóstico completo!');
      }),

      vscode.commands.registerCommand('cappy.testLLM', async () => {
        const out = vscode.window.createOutputChannel('Cappy Test LLM');
        out.clear(); out.show();
        out.appendLine('═══ CAPPY — TEST LLM ═══');
        out.appendLine(`Timestamp: ${new Date().toISOString()}`);

        const chat = vscode.chat as Record<string, unknown>;
        out.appendLine('\n── vscode.chat methods ──');
        Object.keys(chat).forEach(k => out.appendLine(`  chat.${k} = ${typeof chat[k]}`));

        out.appendLine('\n── LLM tools ──');
        out.appendLine(`  Total: ${vscode.lm.tools?.length ?? 0}`);

        out.appendLine('\n═══ FIM ═══');
        vscode.window.showInformationMessage('Cappy: Test LLM completo!');
      }),
    );
  }
}
