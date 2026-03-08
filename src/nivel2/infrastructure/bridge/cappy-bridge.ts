/**
 * @fileoverview Cappy Bridge — Auto-electing WebSocket bridge between VS Code instances and WhatsApp
 * @module bridge/cappy-bridge
 *
 * Architecture:
 * - First VS Code instance to start becomes the SERVER (opens WebSocket + WhatsApp)
 * - Subsequent instances become CLIENTs (connect to existing server)
 * - If the server closes, the next VS Code that opens takes over
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import type { BridgeMessage, BridgeRole, BridgeConfig, WhatsAppStatus } from './types';
import { DEFAULT_BRIDGE_CONFIG } from './types';
import { WhatsAppAdapter } from './whatsapp-adapter';
import { MessageRouter } from './message-router';
import type { IntelligentAgent } from '../agents';
import { WhatsAppApprovalManager } from '../tools/whatsapp-confirmation-tool';

const execAsync = promisify(exec);

/**
 * Main bridge orchestrator.
 * Handles auto-election (server vs client), WhatsApp integration, and message routing.
 */
export class CappyBridge {
  private role: BridgeRole | null = null;
  private config: BridgeConfig;
  private projectName: string;
  private agent: IntelligentAgent;
  private workspaceRoot: string;

  // Server-only
  private wss: WebSocketServer | null = null;
  private whatsapp: WhatsAppAdapter | null = null;
  private router: MessageRouter | null = null;
  private clientSockets = new Map<string, WebSocket>();

  // Client-only
  private clientSocket: WebSocket | null = null;
  private serverInfo: { serverProject: string; whatsappStatus: WhatsAppStatus } | null = null;

  // Status
  private whatsappStatus: WhatsAppStatus = 'disconnected';
  private statusBarItem: vscode.StatusBarItem | null = null;

  // Terminal relay
  private relayTerminal: vscode.Terminal | null = null;

  // Pending WhatsApp reply
  private pendingChatId: string | null = null;

  // Active WhatsApp conversation tracking (avoid restarting agent on each message)
  private activeWhatsAppConversation: {
    chatId: string;
    startedAt: number;
    lastMessageAt: number;
  } | null = null;
  private static readonly CONVERSATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  // Pending workspace query (when user needs to pick a workspace)
  private pendingWorkspaceQuery: { text: string; chatId: string } | null = null;

  // Event callbacks for WebView
  private qrCodeCallback: ((qr: string) => void) | null = null;
  private statusChangeCallback: ((status: { role: string | null; whatsapp: string; projects: string[] }) => void) | null = null;
  private messageCallback: ((from: string, text: string, direction: 'in' | 'out') => void) | null = null;

  constructor(projectName: string, workspaceRoot: string, agent: IntelligentAgent, config?: Partial<BridgeConfig>) {
    this.projectName = projectName;
    this.workspaceRoot = workspaceRoot;
    this.agent = agent;
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
  }

  /**
   * Register a callback for QR code events (used by WebView)
   */
  onQRCode(callback: (qr: string) => void): void {
    this.qrCodeCallback = callback;
  }

  /**
   * Register a callback for status change events (used by WebView)
   */
  onStatusChange(callback: (status: { role: string | null; whatsapp: string; projects: string[] }) => void): void {
    this.statusChangeCallback = callback;
  }

  /**
   * Register a callback for message events (used by WebView)
   */
  onMessage(callback: (from: string, text: string, direction: 'in' | 'out') => void): void {
    this.messageCallback = callback;
  }

  /**
   * Start the bridge — auto-elects as server or client
   */
  async start(): Promise<void> {
    this.createStatusBar();

    // Register bridge globally so LM tools (like WhatsAppConfirmationTool) can access it
    (globalThis as any).__cappyBridge = this;

    try {
      // Try to become the server by binding the port
      await this.startAsServer();
      this.role = 'server';
      console.log(`[Bridge] Started as SERVER on port ${this.config.port}`);
      this.updateStatusBar();

      // Register our own project
      this.router!.registerProject(this.projectName, this.workspaceRoot);

      // Auto-connect WhatsApp if credentials exist from a previous session
      await this.autoConnectWhatsApp();
    } catch {
      // Port already in use — become a client
      this.role = 'client';
      console.log(`[Bridge] Port ${this.config.port} in use — connecting as CLIENT`);
      await this.startAsClient();
      this.updateStatusBar();
    }
  }

  /**
   * Connect WhatsApp (only works if this instance is the server)
   */
  async connectWhatsApp(): Promise<void> {
    if (this.role !== 'server') {
      vscode.window.showWarningMessage(
        'Cappy: WhatsApp can only be connected from the server instance. ' +
        'This VS Code is running as a client.'
      );
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
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Bridge] WhatsApp connect error:', err);
      vscode.window.showErrorMessage(`Cappy: WhatsApp connection failed — ${errMsg}`);
    }
  }

  /**
   * Auto-connect to WhatsApp if saved credentials exist (from a previous session).
   * This avoids requiring a new QR code scan every time the extension restarts.
   */
  private async autoConnectWhatsApp(): Promise<void> {
    const authPath = path.join(this.workspaceRoot, this.config.authDir);
    const credsFile = path.join(authPath, 'creds.json');

    if (fs.existsSync(credsFile)) {
      console.log('[Bridge] Found saved WhatsApp credentials — auto-connecting...');
      try {
        await this.whatsapp?.connect(this.workspaceRoot);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[Bridge] Auto-connect failed:', errMsg);
      }
    } else {
      console.log('[Bridge] No saved credentials — use "Cappy: Connect WhatsApp" to scan QR code.');
    }
  }

  /**
   * Get current status
   */
  getStatus(): { role: BridgeRole | null; whatsapp: WhatsAppStatus; projects: string[]; serverInfo?: { serverProject: string; whatsappStatus: WhatsAppStatus } } {
    return {
      role: this.role,
      whatsapp: this.whatsappStatus,
      projects: this.router?.getProjectNames() || [this.projectName],
      ...(this.role === 'client' && this.serverInfo ? { serverInfo: this.serverInfo } : {}),
    };
  }

  /**
   * Emit status change to registered callback (WebView)
   */
  private emitStatusChange(): void {
    this.statusChangeCallback?.(this.getStatus());
  }

  /**
   * Stop the bridge
   */
  async stop(): Promise<void> {
    if (this.role === 'server') {
      await this.whatsapp?.disconnect();
      this.wss?.close();
      for (const socket of this.clientSockets.values()) {
        socket.close();
      }
      this.clientSockets.clear();
    }

    if (this.role === 'client') {
      this.clientSocket?.close();
    }

    this.statusBarItem?.dispose();
    this.role = null;
    console.log('[Bridge] Stopped');
  }

  // ─── SERVER MODE ──────────────────────────────────────────────────

  private async startAsServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.config.port });

      this.wss.on('listening', () => {
        this.setupRouter();
        this.setupWhatsApp();
        this.setupServerConnections();
        resolve();
      });

      this.wss.on('error', (err) => {
        reject(err);
      });
    });
  }

  private setupRouter(): void {
    this.router = new MessageRouter();
  }

  private setupWhatsApp(): void {
    this.whatsapp = new WhatsAppAdapter(this.config.authDir, {
      onMessage: (text, chatId, pushName) => {
        this.handleWhatsAppMessage(text, chatId, pushName);
      },
      onStatusChange: (status) => {
        this.whatsappStatus = status;
        this.updateStatusBar();
        this.emitStatusChange();
        // Broadcast server_info to all clients so their dashboards update
        this.broadcastServerInfo();
      },
      onQRCode: (qr) => {
        this.showQRCode(qr);
        this.qrCodeCallback?.(qr);
      },
    });
  }

  private setupServerConnections(): void {
    this.wss!.on('connection', (socket) => {
      console.log('[Bridge] New client connected');

      // Send server_info immediately so the client knows who the server is
      this.sendServerInfo(socket);

      socket.on('message', (data) => {
        try {
          const msg: BridgeMessage = JSON.parse(data.toString());
          this.handleClientMessage(socket, msg);
        } catch (err) {
          console.error('[Bridge] Invalid message from client:', err);
        }
      });

      socket.on('close', () => {
        // Find and unregister the project
        for (const [name, s] of this.clientSockets) {
          if (s === socket) {
            this.router?.unregisterProject(name);
            this.clientSockets.delete(name);
            console.log(`[Bridge] Client disconnected: ${name}`);
            break;
          }
        }
      });
    });
  }

  /**
   * Send server_info to a specific client socket
   */
  private sendServerInfo(socket: WebSocket): void {
    const infoMsg: BridgeMessage = {
      type: 'server_info',
      project: this.projectName,
      data: { whatsappStatus: this.whatsappStatus },
      timestamp: Date.now(),
    };
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(infoMsg));
    }
  }

  /**
   * Broadcast server_info to all connected clients
   */
  private broadcastServerInfo(): void {
    for (const socket of this.clientSockets.values()) {
      this.sendServerInfo(socket);
    }
  }

  private handleClientMessage(socket: WebSocket, msg: BridgeMessage): void {
    switch (msg.type) {
      case 'register':
        if (msg.project) {
          this.clientSockets.set(msg.project.toLowerCase(), socket);
          this.router!.registerProject(msg.project, msg.text || '');
        }
        break;

      case 'response':
        // Client sent a response — forward to WhatsApp
        if (msg.chatId && msg.text) {
          this.whatsapp?.sendMessage(msg.chatId, `*Cappy*\n${msg.text}`);
        }
        break;

      case 'media':
        // Client sent media — forward image/video to WhatsApp
        if (msg.chatId && msg.mediaPath && msg.mediaType) {
          this.whatsapp?.sendMedia(msg.chatId, msg.mediaPath, msg.mediaType, msg.caption);
        }
        break;
    }
  }

  private handleWhatsAppMessage(text: string, chatId: string, _pushName: string): void {
    // Emit incoming message to webview
    this.messageCallback?.(_pushName || 'WhatsApp', text, 'in');

    // Check if this is a response to a pending HITL approval (SIM/NÃO)
    const approvalManager = WhatsAppApprovalManager.getInstance();
    if (approvalManager.hasPendingApprovals()) {
      const normalizedText = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isYes = ['sim', 'yes', 's', 'y', 'ok', 'pode', 'autorizo', 'aprovo', '1'].includes(normalizedText);
      const isNo = ['nao', 'no', 'n', 'nope', 'nega', 'cancela', 'rejeito', '2'].includes(normalizedText);

      if (isYes || isNo) {
        approvalManager.resolveApproval(isYes);
        const emoji = isYes ? '✅' : '❌';
        const status = isYes ? 'AUTORIZADO' : 'NEGADO';
        this.whatsapp?.sendMessage(chatId, `${emoji} *Cappy* Ação ${status}.`);
        this.messageCallback?.('Cappy', `HITL: ${status}`, 'out');
        // Store chatId for future confirmations
        this.pendingChatId = chatId;
        return;
      }
    }

    // Check if this is a response to a pending workspace query (user picking a number)
    if (this.pendingWorkspaceQuery && /^\d+$/.test(text.trim())) {
      const num = parseInt(text.trim(), 10);
      const projects = this.router!.getProjectNames();
      if (num >= 1 && num <= projects.length) {
        const selectedProject = projects[num - 1].toLowerCase();
        // Re-process the original message targeting the selected project
        // (the @project prefix will set lastActiveProject via parseMessage)
        const originalText = this.pendingWorkspaceQuery.text;
        this.pendingWorkspaceQuery = null;
        this.handleWhatsAppMessage(`@${selectedProject} ${originalText}`, chatId, _pushName);
        return;
      } else {
        this.whatsapp?.sendMessage(chatId, `*Cappy* Número inválido. Escolha entre 1 e ${projects.length}.`);
        return;
      }
    }
    this.pendingWorkspaceQuery = null;

    const parsed = this.router!.parseMessage(text);

    switch (parsed.type) {
      case 'command': {
        // /new — reset conversation and optionally start a new one with the remaining text
        if (parsed.command === 'new' || parsed.command === 'novo') {
          this.activeWhatsAppConversation = null;
          const remainingText = parsed.text.trim();
          if (remainingText) {
            // /new <message> — start fresh conversation with the message
            this.whatsapp?.sendMessage(chatId, '🔄 *Cappy* Nova conversa iniciada.');
            this.handleLocalChat(remainingText, chatId);
          } else {
            // /new alone — just reset, next message will start fresh
            this.whatsapp?.sendMessage(chatId, '🔄 *Cappy* Conversa resetada. A próxima mensagem inicia uma nova conversa.');
          }
          return;
        }

        const response = this.router!.handleCommand(parsed.command!);
        this.whatsapp?.sendMessage(chatId, response);
        break;
      }

      case 'chat': {
        const targetProject = parsed.targetProject!;

        // If it's our own project, handle locally
        if (targetProject === this.projectName.toLowerCase()) {
          this.handleLocalChat(parsed.text, chatId);
          return;
        }

        // Forward to the correct client
        const clientSocket = this.clientSockets.get(targetProject);
        if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
          const bridgeMsg: BridgeMessage = {
            type: 'chat',
            text: parsed.text,
            chatId,
            project: targetProject,
            timestamp: Date.now(),
          };
          clientSocket.send(JSON.stringify(bridgeMsg));
        } else {
          this.whatsapp?.sendMessage(
            chatId,
            `*Cappy* Projeto "${targetProject}" não está conectado.\nDigite /projetos para ver os disponíveis.`
          );
        }
        break;
      }

      case 'workspace_query': {
        // Projects exist but no active one — ask user to pick
        const projects = this.router!.getProjectNames();
        const list = projects.map((p, i) => `${i + 1}. *${p}*`).join('\n');
        this.whatsapp?.sendMessage(
          chatId,
          `*Cappy* Qual workspace?\n\n${list}\n\nResponda com o número do workspace.`
        );
        this.pendingWorkspaceQuery = { text: parsed.text, chatId };
        break;
      }

      case 'error':
        this.whatsapp?.sendMessage(
          chatId,
          '*Cappy* Nenhum projeto conectado.\nAbra o VS Code com a extensão Cappy instalada.'
        );
        break;
    }
  }

  /**
   * Handle a chat message targeting this VS Code instance's project.
   * Routes based on bridge mode config: agent, terminal, or auto.
   */
  private async handleLocalChat(text: string, chatId: string): Promise<void> {
    // Terminal command with ! prefix always runs in terminal
    if (text.startsWith('!')) {
      const cmd = text.slice(1).trim();
      await this.executeTerminalCommand(cmd, chatId);
      return;
    }

    const response = await this.processMessage(text, chatId);

    // If relayed to chat IDE, don't send response to WhatsApp yet
    // (the AI will use cappy.whatsapp.reply when done)
    if (response.startsWith('📤')) {
      this.whatsapp?.sendMessage(chatId, `*Cappy*\n${response}`);
      this.messageCallback?.('Cappy', response, 'out');
      return;
    }

    this.whatsapp?.sendMessage(chatId, `*Cappy*\n${response}`);

    // Emit outgoing message to webview
    this.messageCallback?.('Cappy', response, 'out');
  }

  // ─── CLIENT MODE ──────────────────────────────────────────────────

  private async startAsClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://localhost:${this.config.port}`;
      this.clientSocket = new WebSocket(url);

      this.clientSocket.on('open', () => {
        // Register our project with the server
        const registerMsg: BridgeMessage = {
          type: 'register',
          project: this.projectName,
          text: this.workspaceRoot,
          timestamp: Date.now(),
        };
        this.clientSocket!.send(JSON.stringify(registerMsg));
        console.log(`[Bridge] Registered as client: ${this.projectName}`);
        resolve();
      });

      this.clientSocket.on('message', (data) => {
        try {
          const msg: BridgeMessage = JSON.parse(data.toString());
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[Bridge] Invalid message from server:', err);
        }
      });

      this.clientSocket.on('close', () => {
        console.log('[Bridge] Disconnected from server');
        this.clientSocket = null;
        this.updateStatusBar();
      });

      this.clientSocket.on('error', (err) => {
        console.error('[Bridge] Client connection error:', err);
        reject(err);
      });
    });
  }

  private handleServerMessage(msg: BridgeMessage): void {
    if (msg.type === 'chat' && msg.text && msg.chatId) {
      // Server forwarded a WhatsApp message to us — process it
      this.processClientMessage(msg.text, msg.chatId);
    }

    if (msg.type === 'server_info' && msg.project) {
      // Server sent its metadata — store for dashboard display
      const data = msg.data as { whatsappStatus?: WhatsAppStatus } | undefined;
      this.serverInfo = {
        serverProject: msg.project,
        whatsappStatus: data?.whatsappStatus || 'disconnected',
      };
      console.log(`[Bridge] Server info received: ${msg.project} (WhatsApp: ${this.serverInfo.whatsappStatus})`);
      this.emitStatusChange();
    }
  }

  /**
   * Process a message received as a client (forwarded by server)
   */
  private async processClientMessage(text: string, chatId: string): Promise<void> {
    let responseText: string;

    if (text.startsWith('!')) {
      responseText = await this.runTerminalCommand(text.slice(1).trim());
    } else {
      responseText = await this.processMessage(text);
    }

    // Send response back to server for forwarding to WhatsApp
    const response: BridgeMessage = {
      type: 'response',
      project: this.projectName,
      text: responseText,
      chatId,
      timestamp: Date.now(),
    };
    this.clientSocket?.send(JSON.stringify(response));
  }

  // ─── MESSAGE PROCESSING ───────────────────────────────────────────

  /**
   * Get the bridge mode from settings
   */
  private getBridgeMode(): 'agent' | 'terminal' | 'auto' {
    const config = vscode.workspace.getConfiguration('cappy.bridge');
    return config.get<string>('mode', 'auto') as 'agent' | 'terminal' | 'auto';
  }

  /**
   * Process a message based on the configured bridge mode.
   * - agent: use built-in IntelligentAgent (requires Copilot)
   * - terminal: relay to a VS Code terminal (works with Antigravity/Cursor/any AI)
   * - auto: always relay to terminal (works with any AI assistant)
   */
  private async processMessage(text: string, _chatId?: string): Promise<string> {
    const mode = this.getBridgeMode();

    // Store pending chatId for reply cycle
    if (_chatId) {
      this.pendingChatId = _chatId;
    }

    switch (mode) {
      case 'agent':
        return this.runAgentAndGetResponse(text);

      case 'terminal':
        return this.relayToTerminal(text);

      case 'auto':
      default: {
        // Auto: try Chat IDE relay first (Antigravity/Copilot), then LLM, then terminal
        return this.relayToChatIDE(text, _chatId);
      }
    }
  }

  // ─── CHAT IDE RELAY ───────────────────────────────────────────────

  /**
   * Persist a WhatsApp message to the inbox for the reply cycle.
   * The AI assistant reads these files via the /whatsapp-reply workflow.
   */
  private persistInbox(text: string, chatId: string): void {
    try {
      const inboxDir = path.join(this.workspaceRoot, '.cappy', 'whatsapp-inbox');
      if (!fs.existsSync(inboxDir)) {
        fs.mkdirSync(inboxDir, { recursive: true });
      }

      const inbox = {
        text,
        chatId,
        timestamp: Date.now(),
        project: this.projectName,
      };

      const filename = `${Date.now()}.json`;
      fs.writeFileSync(path.join(inboxDir, filename), JSON.stringify(inbox, null, 2));
      console.log(`[Bridge] Inbox saved: ${filename}`);
    } catch (err) {
      console.error('[Bridge] Failed to persist inbox:', err);
    }
  }

  /**
   * Check if there's an active WhatsApp conversation that hasn't expired.
   */
  private isConversationActive(chatId: string): boolean {
    if (!this.activeWhatsAppConversation) return false;
    if (this.activeWhatsAppConversation.chatId !== chatId) return false;

    const elapsed = Date.now() - this.activeWhatsAppConversation.lastMessageAt;
    if (elapsed > CappyBridge.CONVERSATION_TIMEOUT_MS) {
      console.log(`[Bridge] Conversation expired (${Math.round(elapsed / 1000)}s idle)`);
      this.activeWhatsAppConversation = null;
      return false;
    }

    return true;
  }

  /**
   * Build the full initial prompt with all rules (used for first message in a conversation).
   */
  private buildInitialPrompt(text: string): string {
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

  /**
   * Build a follow-up prompt (used for subsequent messages in the same conversation).
   * Simpler since the agent already has the rules from the initial prompt.
   */
  private buildFollowUpPrompt(text: string): string {
    return [
      `[WhatsApp] Nova mensagem de ${this.projectName}: "${text}"`,
      ``,
      `Responda ao WhatsApp usando cappy_reply_whatsapp ou o script reply.js.`,
    ].join('\n');
  }

  /**
   * Relay a message to the IDE's AI chat.
   * Tracks active conversations to avoid restarting the agent on every message.
   * - First message from a chatId: starts a new conversation with full rules prompt.
   * - Follow-up messages: sends directly to the existing conversation with a shorter prompt.
   * Falls back through multiple injection methods.
   */
  private async relayToChatIDE(text: string, chatId?: string): Promise<string> {
    // Persist inbox for reply cycle
    if (chatId) {
      this.persistInbox(text, chatId);
    }

    const now = Date.now();
    const hasActiveConversation = chatId ? this.isConversationActive(chatId) : false;

    if (hasActiveConversation) {
      // ── FOLLOW-UP: send to existing conversation without restarting ──
      const followUpPrompt = this.buildFollowUpPrompt(text);

      try {
        await vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', followUpPrompt);
        this.activeWhatsAppConversation!.lastMessageAt = now;
        console.log('[Bridge] Follow-up sent to existing conversation');
        return `📤 Mensagem enviada (conversa existente):\n"${text}"\n\n_Processando com IA..._`;
      } catch (err) {
        console.log('[Bridge] Follow-up sendPromptToAgentPanel failed, starting new conversation:', err);
        // Fall through to create a new conversation
        this.activeWhatsAppConversation = null;
      }
    }

    // ── FIRST MESSAGE: start a new conversation with full rules ──
    const initialPrompt = this.buildInitialPrompt(text);

    // Method 1: Start a new conversation for WhatsApp processing
    try {
      await vscode.commands.executeCommand('antigravity.startNewConversation');
      await new Promise(resolve => setTimeout(resolve, 500));
      await vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', initialPrompt);

      // Track this as the active conversation
      if (chatId) {
        this.activeWhatsAppConversation = { chatId, startedAt: now, lastMessageAt: now };
      }

      console.log('[Bridge] Started NEW conversation + sendPromptToAgentPanel');
      return `📤 Nova conversa criada no Agent Panel:\n"${text}"\n\n_Processando com IA..._`;
    } catch (err) {
      console.log('[Bridge] startNewConversation+sendPromptToAgentPanel failed:', err);
    }

    // Method 2: Send directly to the Agent Panel (fallback — no new conversation)
    try {
      await vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', initialPrompt);

      if (chatId) {
        this.activeWhatsAppConversation = { chatId, startedAt: now, lastMessageAt: now };
      }

      console.log('[Bridge] Relayed via antigravity.sendPromptToAgentPanel (no new conversation)');
      return `📤 Mensagem enviada ao Agent Panel:\n"${text}"\n\n_Processando com IA..._`;
    } catch (err) {
      console.log('[Bridge] antigravity.sendPromptToAgentPanel not available:', err);
    }

    // Method 3: Antigravity chat (tagged @mention — less ideal)
    try {
      const query = `@cappy [WhatsApp de ${this.projectName}]: ${text}`;
      await vscode.commands.executeCommand('antigravity.sendTextToChat', true, query);
      console.log('[Bridge] Relayed via antigravity.sendTextToChat');
      return `📤 Mensagem enviada ao chat do IDE:\n"${text}"\n\n_Aguardando resposta do AI..._`;
    } catch (err) {
      console.log('[Bridge] antigravity.sendTextToChat not available:', err);
    }

    // Method 4: Passive terminal relay (last resort)
    console.log('[Bridge] Falling back to terminal relay...');
    return this.relayToTerminal(text);
  }

  // ─── AGENT & TERMINAL ─────────────────────────────────────────────

  /**
   * Relay a message to a VS Code terminal (passive fallback).
   * Creates a "Cappy Relay" terminal that any AI assistant can monitor.
   */
  private async relayToTerminal(text: string): Promise<string> {
    try {
      // Create or reuse the relay terminal
      if (!this.relayTerminal || this.relayTerminal.exitStatus !== undefined) {
        this.relayTerminal = vscode.window.createTerminal({
          name: 'Cappy Relay',
          cwd: this.workspaceRoot,
          message: 'Cappy WhatsApp Relay — messages from WhatsApp appear here',
        });
      }

      // Show the terminal so the active AI assistant can see it
      this.relayTerminal.show(true);

      // Write the message as a prompt comment + the actual message
      this.relayTerminal.sendText(`# WhatsApp [${this.projectName}]: ${text}`, true);

      return `📨 Mensagem enviada ao terminal "Cappy Relay":\n"${text}"\n\n_O AI assistant ativo no VS Code pode processar._`;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return `❌ Erro no relay: ${errMsg}`;
    }
  }

  // ─── REPLY TO WHATSAPP ────────────────────────────────────────────

  /**
   * Reply to a pending WhatsApp message.
   * Reads the inbox to find the chatId, sends the reply, and clears the inbox.
   */
  async replyToWhatsApp(replyText: string): Promise<void> {
    const inboxDir = path.join(this.workspaceRoot, '.cappy', 'whatsapp-inbox');

    let chatId = this.pendingChatId;

    // Try to read chatId from inbox files
    if (!chatId && fs.existsSync(inboxDir)) {
      const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.json')).sort();
      if (files.length > 0) {
        try {
          const lastFile = files[files.length - 1];
          const data = JSON.parse(fs.readFileSync(path.join(inboxDir, lastFile), 'utf-8'));
          chatId = data.chatId;
        } catch {
          console.error('[Bridge] Failed to read inbox file');
        }
      }
    }

    if (!chatId) {
      vscode.window.showWarningMessage('Cappy: Nenhuma mensagem pendente do WhatsApp para responder.');
      return;
    }

    // Send reply via WhatsApp
    const formattedReply = `*Cappy*\n${replyText}`;
    this.whatsapp?.sendMessage(chatId, formattedReply);

    // Emit outgoing message to webview
    this.messageCallback?.('Cappy', replyText, 'out');

    // Clear inbox
    if (fs.existsSync(inboxDir)) {
      const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(inboxDir, file));
        } catch {
          // ignore cleanup errors
        }
      }
    }

    // Clear pending state
    this.pendingChatId = null;

    console.log('[Bridge] Reply sent to WhatsApp and inbox cleared');
    vscode.window.showInformationMessage('Cappy: Resposta enviada ao WhatsApp ✅');
  }

  /**
   * Send a HITL confirmation request to WhatsApp.
   * Called by WhatsAppConfirmationTool via the global bridge reference.
   */
  sendConfirmationToWhatsApp(message: string): void {
    if (!this.whatsapp || this.whatsappStatus !== 'connected') {
      throw new Error('WhatsApp não está conectado');
    }

    // Use the last known chatId or the owner's chatId
    const chatId = this.pendingChatId || this.config.ownerChatId;
    if (!chatId) {
      throw new Error('Nenhum chatId disponível. Envie uma mensagem pelo WhatsApp primeiro.');
    }

    this.whatsapp.sendMessage(chatId, message);
    this.messageCallback?.('Cappy', '[HITL] Confirmação enviada ao WhatsApp', 'out');
    console.log('[Bridge] HITL confirmation sent to WhatsApp');
  }

  /**
   * Process a message using the vscode.lm API directly.
   * Selects the best available model and sends the message as a prompt.
   * Falls back to terminal relay if no model is available.
   */
  private async processWithLLM(text: string): Promise<string> {
    try {
      // Select any available chat model (works across Antigravity, Cursor, Copilot)
      const models = await vscode.lm.selectChatModels();

      if (!models || models.length === 0) {
        console.log('[Bridge] No LLM models available — falling back to terminal relay');
        return this.relayToTerminal(text);
      }

      const model = models[0];
      console.log(`[Bridge] Using LLM model: ${model.name} (${model.vendor})`);

      const messages = [
        vscode.LanguageModelChatMessage.User(
          `Você é o Cappy, um assistente conciso rodando dentro do VS Code. ` +
          `O projeto atual é "${this.projectName}". ` +
          `Responda de forma curta e direta (máximo 500 palavras). ` +
          `A mensagem a seguir veio do WhatsApp:\n\n${text}`
        ),
      ];

      const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      // Collect streamed response
      let result = '';
      for await (const chunk of response.text) {
        result += chunk;
      }

      console.log('[Bridge] LLM direct response — success');
      return result.trim() || 'Processado, mas sem resposta.';
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Bridge] LLM direct error:', errMsg);

      // Fallback to terminal relay
      console.log('[Bridge] Falling back to terminal relay...');
      return this.relayToTerminal(text);
    }
  }

  /**
   * Run the agent and return the response text
   */
  private async runAgentAndGetResponse(text: string): Promise<string> {
    try {
      const sessionId = `whatsapp-${this.projectName.toLowerCase()}`;
      const { result } = await this.agent.runSessionTurn({
        sessionId,
        message: text,
      });

      // Extract the last assistant message
      if (result.conversationLog) {
        const lastMsg = result.conversationLog[result.conversationLog.length - 1];
        if (lastMsg?.content) {
          return this.cleanForWhatsApp(lastMsg.content);
        }
      }

      return result.responseMessage
        ? this.cleanForWhatsApp(result.responseMessage)
        : 'Processado, mas sem resposta.';
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Bridge] Agent error:', errMsg);

      // Fallback to echo when no LLM is available
      if (errMsg.includes('No LLM available')) {
        console.log('[Bridge] No LLM available — falling back to echo mode');
        return `*Cappy* Echo: ${text}`;
      }

      return `❌ Erro: ${errMsg}`;
    }
  }

  /**
   * Execute a terminal command and send output to WhatsApp
   */
  private async executeTerminalCommand(cmd: string, chatId: string): Promise<void> {
    this.whatsapp?.sendMessage(chatId, `*Cappy* Executando: \`${cmd}\`...`);
    const output = await this.runTerminalCommand(cmd);
    this.whatsapp?.sendMessage(chatId, `*Cappy*\n${output}`);
  }

  /**
   * Run a terminal command and return output
   */
  private async runTerminalCommand(cmd: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.workspaceRoot,
        timeout: 30000, // 30s timeout
        maxBuffer: 1024 * 1024, // 1MB
      });

      const output = (stdout || stderr || '(sem output)').trim();
      // Truncate for WhatsApp (max ~4000 chars)
      return output.length > 3500
        ? output.slice(0, 3500) + '\n\n... (truncado)'
        : output;
    } catch (err: any) {
      const output = err.stdout || err.stderr || err.message || String(err);
      return `❌ Erro:\n${output.slice(0, 3500)}`;
    }
  }

  /**
   * Clean markdown for WhatsApp (simplify heavy formatting)
   */
  private cleanForWhatsApp(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '*')        // Headers → bold marker
      .replace(/```[\s\S]*?```/g, (m) => // Code blocks → mono
        m.replace(/```\w*\n?/g, '').trim()
      )
      .replace(/\*\*(.+?)\*\*/g, '*$1*') // **bold** → *bold*
      .replace(/`([^`]+)`/g, '$1')        // `code` → plain
      .trim();
  }

  // ─── UI ───────────────────────────────────────────────────────────

  private createStatusBar(): void {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'cappy.whatsapp.status';
    this.statusBarItem.show();
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    if (!this.statusBarItem) return;

    if (!this.role) {
      this.statusBarItem.text = 'Cappy: Off';
      this.statusBarItem.tooltip = 'Cappy bridge is not running';
      return;
    }

    const roleIcon = this.role === 'server' ? '🖥️' : '📡';
    const waStatus = this.role === 'server' ? this.getWhatsAppIcon() : '';
    this.statusBarItem.text = `${roleIcon} ${waStatus}`.trim();
    this.statusBarItem.tooltip = `Cappy Bridge: ${this.role.toUpperCase()}\nWhatsApp: ${this.whatsappStatus}\nProject: ${this.projectName}`;
  }

  private getWhatsAppIcon(): string {
    switch (this.whatsappStatus) {
      case 'connected': return '📱✅';
      case 'connecting': return '📱⏳';
      case 'qr_ready': return '📱📷';
      default: return '📱❌';
    }
  }

  private showQRCode(qr: string): void {
    // Show QR code in VS Code output channel
    const outputChannel = vscode.window.createOutputChannel('Cappy WhatsApp');
    outputChannel.clear();
    outputChannel.appendLine('Cappy WhatsApp — Scan the QR Code');
    outputChannel.appendLine('════════════════════════════════════');
    outputChannel.appendLine('');
    outputChannel.appendLine('Open WhatsApp on your phone:');
    outputChannel.appendLine('1. Go to Settings > Linked Devices');
    outputChannel.appendLine('2. Tap "Link a Device"');
    outputChannel.appendLine('3. Scan the QR code below');
    outputChannel.appendLine('');
    outputChannel.appendLine(qr);
    outputChannel.appendLine('');
    outputChannel.appendLine('════════════════════════════════════');
    outputChannel.show();

    vscode.window.showInformationMessage(
      'Cappy: QR Code pronto! Abra o painel "Cappy WhatsApp" e escaneie com seu celular.'
    );
  }
}
