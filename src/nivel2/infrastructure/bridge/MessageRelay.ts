/**
 * @fileoverview MessageRelay — routes incoming messages to IDE chat, terminal, or LLM
 * @module bridge/MessageRelay
 *
 * Owns: relay strategy (IDE/terminal/LLM), fallback chain, prompt building,
 * terminal command execution, and WhatsApp text sanitization.
 * Does NOT know about WebSockets, session state, or routing.
 */

import * as vscode from 'vscode';
import { exec }    from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type RelayMode = 'agent' | 'terminal' | 'auto';

export class MessageRelay {
  private relayTerminal: vscode.Terminal | null = null;

  constructor(
    private readonly projectName: string,
    private readonly workspaceRoot: string,
  ) {}

  // ── Entry point ───────────────────────────────────────────────────

  getBridgeMode(): RelayMode {
    return vscode.workspace
      .getConfiguration('cappy.bridge')
      .get<string>('mode', 'auto') as RelayMode;
  }

  /**
   * Route a message according to the configured bridge mode.
   * Returns a status string (📤 relay / 📨 terminal / ❌ error).
   */
  async relay(
    text: string,
    chatId: string | undefined,
    isActiveConversation: boolean,
    onConversationStarted: (chatId: string) => void,
    onConversationFollowUp: () => void,
  ): Promise<string> {
    const mode = this.getBridgeMode();
    switch (mode) {
      case 'terminal': return this.toTerminal(text);
      case 'auto':     return this.toChatIDE(text, chatId, isActiveConversation, onConversationStarted, onConversationFollowUp);
      case 'agent':    return ''; // handled externally by IntelligentAgent
    }
  }

  // ── IDE relay ─────────────────────────────────────────────────────

  async toChatIDE(
    text: string,
    chatId: string | undefined,
    hasActiveConversation: boolean,
    onStarted: (chatId: string) => void,
    onFollowUp: () => void,
  ): Promise<string> {
    if (hasActiveConversation) {
      try {
        await vscode.commands.executeCommand(
          'antigravity.sendPromptToAgentPanel',
          this._followUpPrompt(text)
        );
        onFollowUp();
        return `📤 Mensagem enviada (conversa existente):\n"${text}"\n\n_Processando com IA..._`;
      } catch {
        // conversation no longer active — fall through to new conversation
      }
    }

    const prompt = this._initialPrompt(text);

    // Method 1: start a fresh conversation
    try {
      await vscode.commands.executeCommand('antigravity.startNewConversation');
      await new Promise(r => setTimeout(r, 500));
      await vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', prompt);
      if (chatId) onStarted(chatId);
      return `📤 Nova conversa criada no Agent Panel:\n"${text}"\n\n_Processando com IA..._`;
    } catch { /* try next */ }

    // Method 2: inject into existing panel
    try {
      await vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', prompt);
      if (chatId) onStarted(chatId);
      return `📤 Mensagem enviada ao Agent Panel:\n"${text}"\n\n_Processando com IA..._`;
    } catch { /* try next */ }

    // Method 3: antigravity chat tagged mention
    try {
      await vscode.commands.executeCommand(
        'antigravity.sendTextToChat', true,
        `@cappy [WhatsApp de ${this.projectName}]: ${text}`
      );
      return `📤 Mensagem enviada ao chat do IDE:\n"${text}"\n\n_Aguardando resposta do AI..._`;
    } catch { /* fall through */ }

    // Method 4: terminal fallback (last resort)
    return this.toTerminal(text);
  }

  // ── Terminal relay ────────────────────────────────────────────────

  async toTerminal(text: string): Promise<string> {
    try {
      if (!this.relayTerminal || this.relayTerminal.exitStatus !== undefined) {
        this.relayTerminal = vscode.window.createTerminal({
          name: 'Cappy Relay',
          cwd: this.workspaceRoot,
          message: 'Cappy WhatsApp Relay — messages from WhatsApp appear here',
        });
      }
      this.relayTerminal.show(true);
      this.relayTerminal.sendText(`# WhatsApp [${this.projectName}]: ${text}`, true);
      return `📨 Mensagem enviada ao terminal "Cappy Relay":\n"${text}"\n\n_O AI assistant ativo no VS Code pode processar._`;
    } catch (err) {
      return `❌ Erro no relay: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // ── Terminal command execution ────────────────────────────────────

  async runTerminalCommand(cmd: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.workspaceRoot,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      });
      const out = (stdout || stderr || '(sem output)').trim();
      return out.length > 3500 ? out.slice(0, 3500) + '\n\n... (truncado)' : out;
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const out = e.stdout || e.stderr || e.message || String(err);
      return `❌ Erro:\n${(out as string).slice(0, 3500)}`;
    }
  }

  // ── Text sanitization ─────────────────────────────────────────────

  cleanForWhatsApp(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '*')
      .replace(/```[\s\S]*?```/g, m => m.replace(/```\w*\n?/g, '').trim())
      .replace(/\*\*(.+?)\*\*/g, '*$1*')
      .replace(/`([^`]+)`/g, '$1')
      .trim();
  }

  // ── Prompt builders ───────────────────────────────────────────────

  private _initialPrompt(text: string): string {
    return [
      `[WhatsApp] Mensagem de ${this.projectName}: "${text}"`,
      ``,
      `⚠️ REGRAS OBRIGATÓRIAS (NÃO IGNORE):`,
      `1. Esta mensagem veio do WhatsApp. O usuário NÃO está no IDE e NÃO verá nada que você escrever aqui.`,
      `2. Você DEVE enviar resposta ao WhatsApp. Se não fizer, o usuário não receberá nada.`,
      `3. MÉTODO PRINCIPAL: Use a tool "cappy_reply_whatsapp" com o parâmetro message.`,
      `4. MÉTODO ALTERNATIVO (se a tool falhar): Execute no terminal:`,
      `   node .agents/skills/whatsapp-reply/scripts/reply.js "SUA RESPOSTA AQUI"`,
      `5. Para ações perigosas (deploy, push, rm, etc.), use "cappy_whatsapp_confirmation" ANTES.`,
      `6. Mantenha respostas CURTAS e em texto plano (sem markdown).`,
      `7. Tools disponíveis: cappy_reply_whatsapp, cappy_whatsapp_confirmation, cappy_run_terminal_command, cappy_grep_search, cappy_read_file.`,
      ``,
      `REGRA DE OURO: Sua resposta SÓ será vista se você usar cappy_reply_whatsapp ou o script reply.js.`,
    ].join('\n');
  }

  private _followUpPrompt(text: string): string {
    return [
      `[WhatsApp] Nova mensagem de ${this.projectName}: "${text}"`,
      ``,
      `Responda ao WhatsApp usando cappy_reply_whatsapp ou o script reply.js.`,
    ].join('\n');
  }
}
