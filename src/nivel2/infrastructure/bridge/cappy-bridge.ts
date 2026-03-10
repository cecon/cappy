/**
 * @fileoverview CappyBridge — thin orchestrator for WhatsApp ↔ VS Code bridge
 * @module bridge/cappy-bridge
 *
 * Architecture:
 * - First VS Code instance to start becomes the SERVER (opens WebSocket + WhatsApp)
 * - Subsequent instances become CLIENTs (connect to existing server)
 * - If the server closes, the next VS Code that opens takes over
 *
 * Responsibility split:
 * - ConnectionManager    — WebSocket server/client election and lifecycle
 * - WhatsAppSessionManager — conversation state and inbox persistence
 * - MessageRelay         — relay to IDE chat / terminal / LLM
 * - ApprovalFlow         — HITL with per-chatId validation
 * - MessageRouter        — project name routing and /commands
 * - WhatsAppAdapter      — Baileys integration
 */

import * as path      from 'node:path';
import * as fs        from 'node:fs';
import * as vscode    from 'vscode';

import type { BridgeMessage, BridgeConfig, WhatsAppStatus } from './types';
import { DEFAULT_BRIDGE_CONFIG }   from './types';
import { WhatsAppAdapter }         from './whatsapp-adapter';
import { MessageRouter }           from './message-router';
import { ConnectionManager }       from './ConnectionManager';
import { WhatsAppSessionManager }  from './WhatsAppSessionManager';
import { MessageRelay }            from './MessageRelay';
import { ApprovalFlow }            from './ApprovalFlow';
import { AuditLog }                from '../security/CommandPolicy';
import type { IntelligentAgent }   from '../agents';
import type { CronScheduler }      from '../scheduler/CronScheduler';

export class CappyBridge {
  // ── Core modules ─────────────────────────────────────────────────
  private readonly connection = new ConnectionManager();
  private readonly session    = new WhatsAppSessionManager();
  private readonly relay:     MessageRelay;
  private readonly approval   = ApprovalFlow.getInstance();
  private readonly audit:     AuditLog;

  // ── Infrastructure ────────────────────────────────────────────────
  private whatsapp: WhatsAppAdapter | null = null;
  private router:   MessageRouter   | null = null;
  private scheduler: CronScheduler  | null = null;

  // ── Config / identity ─────────────────────────────────────────────
  private readonly config: BridgeConfig;
  private whatsappStatus: WhatsAppStatus = 'disconnected';
  private statusBarItem: vscode.StatusBarItem | null = null;

  // ── Webview callbacks ─────────────────────────────────────────────
  private qrCodeCallback:     ((qr: string) => void) | null = null;
  private statusChangeCallback: ((s: { role: string | null; whatsapp: string; projects: string[] }) => void) | null = null;
  private messageCallback:    ((from: string, text: string, dir: 'in' | 'out') => void) | null = null;

  // ── Server info (client-only) ─────────────────────────────────────
  private serverInfo: { serverProject: string; whatsappStatus: WhatsAppStatus } | null = null;

  constructor(
    private readonly projectName: string,
    private readonly workspaceRoot: string,
    private readonly agent: IntelligentAgent,
    config?: Partial<BridgeConfig>,
  ) {
    this.config  = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    this.relay   = new MessageRelay(projectName, workspaceRoot);
    this.audit   = new AuditLog(workspaceRoot);
  }

  // ── Public event hooks ────────────────────────────────────────────

  onQRCode(cb: (qr: string) => void): void                                                              { this.qrCodeCallback = cb; }
  onStatusChange(cb: (s: { role: string | null; whatsapp: string; projects: string[] }) => void): void { this.statusChangeCallback = cb; }
  onMessage(cb: (from: string, text: string, dir: 'in' | 'out') => void): void                        { this.messageCallback = cb; }
  setScheduler(s: CronScheduler): void { this.scheduler = s; }

  // ── Lifecycle ─────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.createStatusBar();
    (globalThis as Record<string, unknown>)['__cappyBridge'] = this;

    try {
      await this.connection.tryBecomeServer(this.config.port);
      console.log(`[Bridge] Started as SERVER on port ${this.config.port}`);
      this._setupAsServer();
      await this.autoConnectWhatsApp();
    } catch {
      console.log(`[Bridge] Port ${this.config.port} in use — connecting as CLIENT`);
      await this.connection.connectAsClient(this.config.port, this.projectName, this.workspaceRoot);
      this._setupAsClient();
    }

    this.updateStatusBar();
  }

  async stop(): Promise<void> {
    await this.whatsapp?.disconnect();
    this.connection.stop();
    this.statusBarItem?.dispose();
    console.log('[Bridge] Stopped');
  }

  async connectWhatsApp(): Promise<void> {
    if (this.connection.getRole() !== 'server') {
      vscode.window.showWarningMessage('Cappy: WhatsApp can only be connected from the server instance.');
      return;
    }
    if (!this.whatsapp) {
      vscode.window.showErrorMessage('Cappy: Bridge not initialized');
      return;
    }
    try {
      vscode.window.showInformationMessage('Cappy: Connecting to WhatsApp...');
      await this.whatsapp.connect(this.workspaceRoot);
    } catch (err) {
      vscode.window.showErrorMessage(`Cappy: WhatsApp connection failed — ${err instanceof Error ? err.message : err}`);
    }
  }

  getStatus() {
    return {
      role: this.connection.getRole(),
      whatsapp: this.whatsappStatus,
      projects: this.router?.getProjectNames() ?? [this.projectName],
      ...(this.connection.getRole() === 'client' && this.serverInfo ? { serverInfo: this.serverInfo } : {}),
    };
  }

  // ── Server setup ──────────────────────────────────────────────────

  private _setupAsServer(): void {
    this.router = new MessageRouter();
    this.router.registerProject(this.projectName, this.workspaceRoot);

    this.whatsapp = new WhatsAppAdapter(this.config.authDir, {
      onMessage: (text, chatId, pushName) => this._handleWhatsAppMessage(text, chatId, pushName),
      onStatusChange: (status) => {
        this.whatsappStatus = status;
        this.updateStatusBar();
        this._emitStatusChange();
        this._broadcastServerInfo();
      },
      onQRCode: (qr) => {
        this._showQRCode(qr);
        this.qrCodeCallback?.(qr);
      },
    });

    this.connection.onClientConnect((project, wsRoot) => {
      this.router!.registerProject(project, wsRoot);
      this._sendServerInfo_toAll();
    });

    this.connection.onClientDisconnect((project) => {
      this.router?.unregisterProject(project);
    });

    this.connection.onClientMessage((socket, msg) => {
      this._handleClientMessage(socket, msg);
    });
  }

  // ── Client setup ──────────────────────────────────────────────────

  private _setupAsClient(): void {
    this.connection.onServerMessage((msg) => {
      if (msg.type === 'chat' && msg.text && msg.chatId) {
        this._processClientMessage(msg.text, msg.chatId);
      }
      if (msg.type === 'server_info' && msg.project) {
        const data = msg.data as { whatsappStatus?: WhatsAppStatus } | undefined;
        this.serverInfo = {
          serverProject: msg.project,
          whatsappStatus: data?.whatsappStatus ?? 'disconnected',
        };
        this._emitStatusChange();
      }
    });
  }

  // ── WhatsApp auto-connect ─────────────────────────────────────────

  private async autoConnectWhatsApp(): Promise<void> {
    const credsFile = path.join(this.workspaceRoot, this.config.authDir, 'creds.json');
    if (fs.existsSync(credsFile)) {
      console.log('[Bridge] Found saved credentials — auto-connecting...');
      try { await this.whatsapp?.connect(this.workspaceRoot); }
      catch (err) { console.error('[Bridge] Auto-connect failed:', err); }
    }
  }

  // ── Server: handle messages from clients ──────────────────────────

  private _handleClientMessage(socket: import('ws').WebSocket, msg: BridgeMessage): void {
    switch (msg.type) {
      case 'response':
        if (msg.chatId && msg.text) {
          this.whatsapp?.sendMessage(msg.chatId, `*Cappy*\n${msg.text}`);
          this.messageCallback?.(msg.project ?? 'Cappy', msg.text, 'out');
        }
        break;

      case 'media':
        if (msg.chatId && msg.mediaPath && msg.mediaType) {
          this.whatsapp?.sendMedia(msg.chatId, msg.mediaPath, msg.mediaType, msg.caption);
        }
        break;

      case 'scheduler_add':
        if (this.scheduler && msg.data) {
          try {
            const task = this.scheduler.addTask(msg.data as Record<string, unknown>);
            if (socket.readyState === 1 /* OPEN */) {
              socket.send(JSON.stringify({ type: 'scheduler_add', data: { success: true, task }, timestamp: Date.now() }));
            }
          } catch (err) {
            if (socket.readyState === 1) {
              socket.send(JSON.stringify({ type: 'scheduler_add', data: { success: false, error: String(err) }, timestamp: Date.now() }));
            }
          }
        }
        break;
    }
  }

  // ── Server: handle messages from WhatsApp ────────────────────────

  private _handleWhatsAppMessage(text: string, chatId: string, pushName: string): void {
    this.messageCallback?.(pushName || 'WhatsApp', text, 'in');

    // ── HITL check (chatId-validated) ──
    if (this.approval.hasPendingFor(chatId)) {
      const normalized = text.trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isYes = ['sim', 'yes', 's', 'y', 'ok', 'pode', 'autorizo', 'aprovo', '1'].includes(normalized);
      const isNo  = ['nao', 'no',  'n',        'nope', 'nega', 'cancela', 'rejeito', '2'].includes(normalized);

      if (isYes || isNo) {
        const resolved = this.approval.resolve(chatId, isYes);
        if (resolved) {
          const label = isYes ? 'AUTORIZADO' : 'NEGADO';
          this.whatsapp?.sendMessage(chatId, `${isYes ? '✅' : '❌'} *Cappy* Ação ${label}.`);
          this.messageCallback?.('Cappy', `HITL: ${label}`, 'out');
          this.audit.write({ type: isYes ? 'hitl_approved' : 'hitl_rejected', timestamp: new Date().toISOString(), project: this.projectName, chatId });
          this.session.setPendingChatId(chatId);
          return;
        }
      }
    }

    // ── Workspace query (user picked a number) ──
    const pending = this.session.getPendingWorkspaceQuery();
    if (pending && /^\d+$/.test(text.trim())) {
      const num = parseInt(text.trim(), 10);
      const projects = this.router!.getProjectNames();
      if (num >= 1 && num <= projects.length) {
        const selected = projects[num - 1];
        this.session.clearPendingWorkspaceQuery();
        this._handleWhatsAppMessage(`@${selected} ${pending.text}`, chatId, pushName);
      } else {
        this.whatsapp?.sendMessage(chatId, `*Cappy* Número inválido. Escolha entre 1 e ${projects.length}.`);
      }
      return;
    }
    this.session.clearPendingWorkspaceQuery();

    const parsed = this.router!.parseMessage(text);

    switch (parsed.type) {
      case 'command':
        if (parsed.command === 'new' || parsed.command === 'novo') {
          this.session.resetConversation();
          const remaining = parsed.text.trim();
          this.whatsapp?.sendMessage(chatId, '🔄 *Cappy* Conversa resetada.');
          if (remaining) this._handleLocalChat(remaining, chatId);
        } else {
          this.whatsapp?.sendMessage(chatId, this.router!.handleCommand(parsed.command!));
        }
        break;

      case 'chat': {
        const target = parsed.targetProject!;
        if (target === this.projectName.toLowerCase()) {
          this._handleLocalChat(parsed.text, chatId);
        } else if (this.connection.hasClient(target)) {
          this.whatsapp?.sendTyping(chatId);
          this.connection.sendToClient(target, { type: 'chat', text: parsed.text, chatId, project: target, timestamp: Date.now() });
        } else {
          this.whatsapp?.sendMessage(chatId, `*Cappy* Projeto "${target}" não está conectado.\nDigite /projetos para ver os disponíveis.`);
        }
        break;
      }

      case 'workspace_query': {
        const list = this.router!.getProjectNames().map((p, i) => `${i + 1}. *${p}*`).join('\n');
        this.whatsapp?.sendMessage(chatId, `*Cappy* Qual workspace?\n\n${list}\n\nResponda com o número do workspace.`);
        this.session.setPendingWorkspaceQuery({ text: parsed.text, chatId });
        break;
      }

      case 'error':
        this.whatsapp?.sendMessage(chatId, '*Cappy* Nenhum projeto conectado.\nAbra o VS Code com a extensão Cappy instalada.');
        break;
    }
  }

  private async _handleLocalChat(text: string, chatId: string): Promise<void> {
    if (text.startsWith('!')) {
      const cmd = text.slice(1).trim();
      this.audit.write({ type: 'command_allowed', timestamp: new Date().toISOString(), project: this.projectName, chatId, command: cmd });
      this.whatsapp?.sendMessage(chatId, `*Cappy* Executando: \`${cmd}\`...`);
      const output = await this.relay.runTerminalCommand(cmd);
      this.whatsapp?.sendMessage(chatId, `*Cappy*\n${output}`);
      return;
    }

    const mode = this.relay.getBridgeMode();
    if (mode === 'agent') {
      const response = await this._runAgent(text);
      this.whatsapp?.sendMessage(chatId, `*Cappy*\n${response}`);
      this.messageCallback?.('Cappy', response, 'out');
      return;
    }

    // auto/terminal — persist inbox first
    this.session.persistInbox(text, chatId, this.projectName, this.workspaceRoot);
    this.whatsapp?.sendTyping(chatId);

    const result = await this.relay.relay(
      text, chatId,
      this.session.isConversationActive(chatId),
      (id) => this.session.startConversation(id),
      ()   => this.session.touchConversation(),
    );

    if (!result.startsWith('📤')) {
      this.whatsapp?.sendMessage(chatId, `*Cappy*\n${result}`);
      this.messageCallback?.('Cappy', result, 'out');
    }
  }

  // ── Client: process forwarded messages ───────────────────────────

  private async _processClientMessage(text: string, chatId: string): Promise<void> {
    let response: string;
    if (text.startsWith('!')) {
      response = await this.relay.runTerminalCommand(text.slice(1).trim());
    } else {
      response = await this._runAgent(text);
    }
    this.connection.sendToServer({ type: 'response', project: this.projectName, text: response, chatId, timestamp: Date.now() });
  }

  // ── Agent ─────────────────────────────────────────────────────────

  private async _runAgent(text: string): Promise<string> {
    try {
      const { result } = await this.agent.runSessionTurn({
        sessionId: `whatsapp-${this.projectName.toLowerCase()}`,
        message: text,
      });
      const last = result.conversationLog?.[result.conversationLog.length - 1];
      const raw = last?.content ?? result.responseMessage ?? 'Processado, mas sem resposta.';
      return this.relay.cleanForWhatsApp(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('No LLM available')) return `*Cappy* Echo: ${text}`;
      return `❌ Erro: ${msg}`;
    }
  }

  // ── Reply to WhatsApp (used by AI assistant tools) ────────────────

  async replyToWhatsApp(replyText: string): Promise<void> {
    const chatId = this.session.getPendingChatId()
      ?? this.session.readLatestChatId(this.workspaceRoot);

    if (!chatId) {
      vscode.window.showWarningMessage('Cappy: Nenhuma mensagem pendente do WhatsApp para responder.');
      return;
    }

    this.whatsapp?.sendMessage(chatId, `*Cappy*\n${replyText}`);
    this.messageCallback?.('Cappy', replyText, 'out');
    this.session.clearInbox(this.workspaceRoot);
    this.session.clearPendingChatId();
    vscode.window.showInformationMessage('Cappy: Resposta enviada ao WhatsApp ✅');
  }

  /** Called by WhatsAppConfirmationTool (via globalThis.__cappyBridge) */
  sendConfirmationToWhatsApp(message: string): void {
    if (!this.whatsapp || this.whatsappStatus !== 'connected') {
      throw new Error('WhatsApp não está conectado');
    }
    const chatId = this.session.getPendingChatId() ?? this.config.ownerChatId;
    if (!chatId) {
      throw new Error('Nenhum chatId disponível. Envie uma mensagem pelo WhatsApp primeiro.');
    }
    this.whatsapp.sendMessage(chatId, message);
    this.messageCallback?.('Cappy', '[HITL] Confirmação enviada ao WhatsApp', 'out');
    this.audit.write({ type: 'hitl_requested', timestamp: new Date().toISOString(), project: this.projectName, chatId });
  }

  // ── Server info broadcast ─────────────────────────────────────────

  private _broadcastServerInfo(): void {
    this.connection.broadcastToClients({
      type: 'server_info',
      project: this.projectName,
      data: { whatsappStatus: this.whatsappStatus },
      timestamp: Date.now(),
    });
  }

  private _sendServerInfo_toAll(): void {
    this._broadcastServerInfo();
  }

  // ── Status bar ────────────────────────────────────────────────────

  private createStatusBar(): void {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'cappy.whatsapp.status';
    this.statusBarItem.show();
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    if (!this.statusBarItem) return;
    const role = this.connection.getRole();
    if (!role) {
      this.statusBarItem.text = 'Cappy: Off';
      return;
    }
    const roleIcon = role === 'server' ? '🖥️' : '📡';
    const waIcon   = role === 'server' ? this._waIcon() : '';
    this.statusBarItem.text    = `${roleIcon} ${waIcon}`.trim();
    this.statusBarItem.tooltip = `Cappy Bridge: ${role.toUpperCase()}\nWhatsApp: ${this.whatsappStatus}\nProject: ${this.projectName}`;
  }

  private _waIcon(): string {
    switch (this.whatsappStatus) {
      case 'connected':   return '📱✅';
      case 'connecting':  return '📱⏳';
      case 'qr_ready':    return '📱📷';
      default:            return '📱❌';
    }
  }

  private _emitStatusChange(): void {
    this.statusChangeCallback?.(this.getStatus());
  }

  private _showQRCode(qr: string): void {
    const out = vscode.window.createOutputChannel('Cappy WhatsApp');
    out.clear();
    out.appendLine('Cappy WhatsApp — Scan the QR Code');
    out.appendLine('════════════════════════════════════');
    out.appendLine('Open WhatsApp → Settings → Linked Devices → Link a Device');
    out.appendLine('');
    out.appendLine(qr);
    out.show();
    vscode.window.showInformationMessage('Cappy: QR Code pronto! Abra o painel "Cappy WhatsApp" e escaneie com seu celular.');
  }
}
