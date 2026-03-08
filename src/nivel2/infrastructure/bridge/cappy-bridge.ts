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

  // Status
  private whatsappStatus: WhatsAppStatus = 'disconnected';
  private statusBarItem: vscode.StatusBarItem | null = null;

  // Terminal relay
  private relayTerminal: vscode.Terminal | null = null;

  // Pending WhatsApp reply
  private pendingChatId: string | null = null;

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

    try {
      // Try to become the server
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
  getStatus(): { role: BridgeRole | null; whatsapp: WhatsAppStatus; projects: string[] } {
    return {
      role: this.role,
      whatsapp: this.whatsappStatus,
      projects: this.router?.getProjectNames() || [this.projectName],
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
    }
  }

  private handleWhatsAppMessage(text: string, chatId: string, _pushName: string): void {
    // Emit incoming message to webview
    this.messageCallback?.(_pushName || 'WhatsApp', text, 'in');

    const parsed = this.router!.parseMessage(text);

    switch (parsed.type) {
      case 'command': {
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
   * Relay a message to the IDE's AI chat.
   * Tries multiple methods with fallback:
   * 1. antigravity.sendPromptToAgentPanel (Antigravity Agent Panel — best)
   * 2. antigravity.sendTextToChat (Antigravity IDE — tagged @mention)
   * 3. Terminal relay (passive fallback)
   */
  private async relayToChatIDE(text: string, chatId?: string): Promise<string> {
    // Persist inbox for reply cycle
    if (chatId) {
      this.persistInbox(text, chatId);
    }

    const prompt = `[WhatsApp de ${this.projectName}]: ${text}\n\nEsta é uma mensagem vinda do WhatsApp. Por favor, use a skill "whatsapp-reply" (em .agents/skills/whatsapp-reply/SKILL.md) e o workflow /whatsapp-reply para processar e responder esta mensagem de volta ao WhatsApp.`;

    // Method 1: Send directly to the Agent Panel (best — processes as a prompt)
    try {
      await vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', prompt);
      console.log('[Bridge] Relayed via antigravity.sendPromptToAgentPanel');
      return `📤 Mensagem enviada ao Agent Panel:\n"${text}"\n\n_Aguardando resposta do AI..._`;
    } catch (err) {
      console.log('[Bridge] antigravity.sendPromptToAgentPanel not available:', err);
    }

    // Method 2: Antigravity chat (tagged @mention — less ideal)
    try {
      const query = `@cappy [WhatsApp de ${this.projectName}]: ${text}`;
      await vscode.commands.executeCommand('antigravity.sendTextToChat', true, query);
      console.log('[Bridge] Relayed via antigravity.sendTextToChat');
      return `📤 Mensagem enviada ao chat do IDE:\n"${text}"\n\n_Aguardando resposta do AI..._`;
    } catch (err) {
      console.log('[Bridge] antigravity.sendTextToChat not available:', err);
    }

    // Method 3: Passive terminal relay (last resort)
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
