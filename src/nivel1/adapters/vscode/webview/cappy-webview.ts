/**
 * @fileoverview Cappy WebView — Dashboard panel with QR code, status, and settings
 * @module webview/cappy-webview
 */

import * as vscode from 'vscode';
import type { CappyBridge } from '../../../../nivel2/infrastructure/bridge/cappy-bridge';

/**
 * WebView provider for the Cappy sidebar panel.
 * Shows WhatsApp QR code, connection status, project list, and settings.
 */
export class CappyWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cappy.dashboard';

  private view: vscode.WebviewView | null = null;
  private bridge: CappyBridge | null = null;
  private qrCode: string | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Set bridge reference (called after bridge starts)
   */
  setBridge(bridge: CappyBridge): void {
    this.bridge = bridge;
  }

  /**
   * Update the QR code displayed in the webview
   */
  updateQRCode(qr: string): void {
    this.qrCode = qr;
    this.postMessage({ type: 'qr', data: qr });
  }

  /**
   * Update status in the webview
   */
  updateStatus(status: {
    role: string | null;
    whatsapp: string;
    projects: string[];
    serverInfo?: { serverProject: string; whatsappStatus: string };
  }): void {
    this.postMessage({ type: 'status', data: status });
  }

  /**
   * Clear the QR code (connected successfully)
   */
  clearQRCode(): void {
    this.qrCode = null;
    this.postMessage({ type: 'qr-clear' });
  }

  /**
   * Add a message to the chat log in the webview
   */
  addMessage(from: string, text: string, direction: 'in' | 'out'): void {
    this.postMessage({
      type: 'message',
      data: { from, text, direction, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
    });
  }

  /**
   * Called when the webview is resolved
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'connect':
          vscode.commands.executeCommand('cappy.whatsapp.connect');
          break;

        case 'disconnect':
          this.bridge?.stop();
          break;

        case 'setting': {
          const config = vscode.workspace.getConfiguration('cappy.bridge');
          config.update(msg.key, msg.value, vscode.ConfigurationTarget.Global);
          break;
        }

        case 'refresh':
          this.refreshStatus();
          break;
      }
    });

    // Send initial state
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refreshStatus();
      }
    });

    // Refresh on load
    this.refreshStatus();
  }

  /**
   * Refresh status from bridge
   */
  private refreshStatus(): void {
    if (!this.bridge) return;
    const status = this.bridge.getStatus();
    this.updateStatus(status);

    // Re-send QR if we have one
    if (this.qrCode) {
      this.postMessage({ type: 'qr', data: this.qrCode });
    }

    // Send current settings
    const config = vscode.workspace.getConfiguration('cappy.bridge');
    this.postMessage({
      type: 'settings',
      data: {
        mode: config.get<string>('mode', 'auto'),
        chatFilter: config.get<string>('chatFilter', 'self'),
        allowedGroupName: config.get<string>('allowedGroupName', 'Cappy Dev'),
      },
    });
  }

  /**
   * Post a message to the webview
   */
  private postMessage(msg: any): void {
    this.view?.webview.postMessage(msg);
  }

  /**
   * Generate the HTML content for the webview
   */
  private getHtmlContent(webview: vscode.Webview): string {
    const iconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'assets', 'icon.png'),
    );

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --cappy-green: #25D366;
      --cappy-green-dim: rgba(37, 211, 102, 0.12);
      --cappy-green-glow: rgba(37, 211, 102, 0.3);
      --cappy-red: #ef4444;
      --cappy-red-dim: rgba(239, 68, 68, 0.12);
      --cappy-amber: #f59e0b;
      --cappy-amber-dim: rgba(245, 158, 11, 0.12);
      --cappy-blue: #3b82f6;
      --cappy-blue-dim: rgba(59, 130, 246, 0.12);
      --cappy-radius: 10px;
      --cappy-radius-sm: 6px;
      --cappy-transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 10px;
      overflow-x: hidden;
    }

    /* ── Header / Brand ── */
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0 14px;
    }

    .header img {
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }

    .header-text {
      display: flex;
      flex-direction: column;
    }

    .header-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }

    .header-sub {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.2px;
    }

    /* ── Cards ── */
    .card {
      margin-bottom: 10px;
      padding: 14px;
      background: var(--vscode-editor-background);
      border-radius: var(--cappy-radius);
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06));
      transition: border-color var(--cappy-transition);
    }

    .card:hover {
      border-color: var(--vscode-focusBorder);
    }

    .card-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* ── Status Indicator (hero ring) ── */
    .status-ring {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
      position: relative;
      transition: all var(--cappy-transition);
    }

    .status-ring::before {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2.5px solid transparent;
      transition: border-color var(--cappy-transition);
    }

    .status-ring .ring-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .status-ring .ring-icon svg {
      width: 28px;
      height: 28px;
      fill: currentColor;
    }

    /* ── SVG Icon Utility ── */
    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    }

    .icon svg {
      fill: currentColor;
    }

    .icon-xs svg { width: 12px; height: 12px; }
    .icon-sm svg { width: 14px; height: 14px; }
    .icon-md svg { width: 16px; height: 16px; }
    .icon-lg svg { width: 20px; height: 20px; }
    .icon-xl svg { width: 28px; height: 28px; }

    .ring-disconnected { background: var(--cappy-red-dim); }
    .ring-disconnected::before { border-color: var(--cappy-red); }
    .ring-connected { background: var(--cappy-green-dim); }
    .ring-connected::before { border-color: var(--cappy-green); animation: ring-glow 2.5s ease-in-out infinite; }
    .ring-connecting { background: var(--cappy-amber-dim); }
    .ring-connecting::before { border-color: var(--cappy-amber); animation: ring-spin 1.2s linear infinite; }
    .ring-qr { background: var(--cappy-blue-dim); }
    .ring-qr::before { border-color: var(--cappy-blue); animation: ring-glow 1.5s ease-in-out infinite; }

    @keyframes ring-glow {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 transparent; }
      50% { opacity: 0.7; box-shadow: 0 0 12px var(--cappy-green-glow); }
    }

    @keyframes ring-spin {
      to { transform: rotate(360deg); }
    }

    .status-label {
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .status-hint {
      text-align: center;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
      line-height: 1.4;
    }

    /* ── Buttons ── */
    .btn {
      width: 100%;
      padding: 9px 14px;
      border: none;
      border-radius: var(--cappy-radius-sm);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all var(--cappy-transition);
      position: relative;
      overflow: hidden;
    }

    .btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.06), transparent);
      pointer-events: none;
    }

    .btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
    .btn:active { transform: translateY(0); }
    .btn:disabled { opacity: 0.5; pointer-events: none; transform: none; }

    .btn-cta {
      background: var(--cappy-green);
      color: #fff;
      box-shadow: 0 2px 8px rgba(37, 211, 102, 0.25);
    }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn-ghost {
      background: transparent;
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
      font-size: 11px;
      padding: 6px 10px;
    }

    .btn-ghost:hover { color: var(--vscode-foreground); background: var(--vscode-input-background); }

    /* ── QR Area ── */
    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      gap: 10px;
    }

    .qr-frame {
      background: #fff;
      padding: 10px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      max-width: 200px;
      width: 100%;
      transition: transform var(--cappy-transition);
    }

    .qr-frame:hover { transform: scale(1.03); }

    .qr-img {
      width: 100%;
      image-rendering: pixelated;
      border-radius: 4px;
    }

    .qr-steps {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      line-height: 1.5;
    }

    .qr-steps b { color: var(--vscode-foreground); }

    /* ── Info chips (inline status row) ── */
    .info-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-widget-border, transparent);
      transition: background var(--cappy-transition);
    }

    .chip-icon { display: inline-flex; align-items: center; }
    .chip-icon svg { width: 12px; height: 12px; fill: currentColor; }

    /* ── Chat / Messages ── */
    .chat-area {
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 2px 0;
      scroll-behavior: smooth;
    }

    .chat-area::-webkit-scrollbar { width: 4px; }
    .chat-area::-webkit-scrollbar-track { background: transparent; }
    .chat-area::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 4px; }

    .chat-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 8px;
      gap: 6px;
    }

    .chat-empty-icon { opacity: 0.4; display: flex; align-items: center; justify-content: center; }
    .chat-empty-icon svg { width: 28px; height: 28px; fill: currentColor; }
    .chat-empty-text {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      line-height: 1.4;
    }

    .msg-bubble {
      max-width: 88%;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 12px;
      line-height: 1.45;
      word-break: break-word;
      animation: msg-in 0.2s ease-out;
      position: relative;
    }

    @keyframes msg-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .msg-in {
      align-self: flex-start;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-widget-border, transparent);
      border-bottom-left-radius: 4px;
    }

    .msg-out {
      align-self: flex-end;
      background: var(--cappy-green-dim);
      border: 1px solid rgba(37, 211, 102, 0.2);
      border-bottom-right-radius: 4px;
    }

    .msg-from {
      font-size: 10px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 3px;
    }

    .msg-out .msg-from { color: var(--cappy-green); }

    .msg-time {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
      text-align: right;
      margin-top: 3px;
      opacity: 0.7;
    }

    .msg-text { white-space: pre-wrap; }

    /* ── Accordion (Settings) ── */
    .accordion {
      border-radius: var(--cappy-radius);
      overflow: hidden;
    }

    .accordion-trigger {
      width: 100%;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06));
      border-radius: var(--cappy-radius);
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 600;
      font-family: inherit;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all var(--cappy-transition);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .accordion-trigger:hover {
      color: var(--vscode-foreground);
      border-color: var(--vscode-focusBorder);
    }

    .accordion-trigger .chevron {
      transition: transform var(--cappy-transition);
      display: inline-flex;
      align-items: center;
    }

    .accordion-trigger .chevron svg {
      width: 10px;
      height: 10px;
      fill: currentColor;
    }

    .accordion-trigger[aria-expanded="true"] .chevron {
      transform: rotate(180deg);
    }

    .accordion-trigger[aria-expanded="true"] {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: transparent;
    }

    .accordion-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease-out, padding 0.3s ease-out;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06));
      border-top: none;
      border-bottom-left-radius: var(--cappy-radius);
      border-bottom-right-radius: var(--cappy-radius);
      padding: 0 14px;
    }

    .accordion-content.open {
      max-height: 500px;
      padding: 10px 14px 14px;
    }

    .select-field {
      width: 100%;
      padding: 7px 10px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: var(--cappy-radius-sm);
      font-size: 12px;
      font-family: inherit;
      margin-top: 4px;
      margin-bottom: 8px;
      transition: border-color var(--cappy-transition);
    }

    .input-field {
      width: 100%;
      padding: 7px 10px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: var(--cappy-radius-sm);
      font-size: 12px;
      font-family: inherit;
      margin-top: 4px;
      outline: none;
      transition: border-color var(--cappy-transition);
    }

    .input-field:focus, .select-field:focus {
      border-color: var(--vscode-focusBorder);
      outline: none;
    }

    .setting-label {
      font-size: 10px;
      font-weight: 500;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
      display: block;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* ── Project Tags ── */
    .project-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }

    .project-tag {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--cappy-blue-dim);
      color: var(--cappy-blue);
      font-weight: 500;
    }

    /* ── States: show/hide ── */
    .hidden { display: none !important; }

    /* ── Footer ── */
    .footer {
      display: flex;
      justify-content: center;
      padding-top: 6px;
    }
  </style>
</head>
<body>

  <!-- ── Header ── -->
  <div class="header">
    <img src="${iconUri}" alt="Cappy" />
    <div class="header-text">
      <span class="header-title">Cappy</span>
      <span class="header-sub">WhatsApp Dev Bridge</span>
    </div>
  </div>

  <!-- ── Hero Status Card ── -->
  <div class="card" id="hero-card">
    <div id="status-ring" class="status-ring ring-disconnected">
      <span class="ring-icon"><svg viewBox="0 0 16 16"><path d="M11 1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM5 2h6v10H5V2zm2.5 11.5a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0z"/></svg></span>
    </div>
    <div id="status-label" class="status-label">Desconectado</div>
    <div id="status-hint" class="status-hint">Conecte ao WhatsApp para começar</div>

    <!-- QR Area (shown when QR is ready) -->
    <div id="qr-area" class="hidden">
      <div class="qr-container">
        <div class="qr-frame">
          <img id="qr-img" class="qr-img" alt="QR Code" />
        </div>
        <div class="qr-steps">
          <b>1.</b> Abra o WhatsApp<br/>
          <b>2.</b> Dispositivos Conectados<br/>
          <b>3.</b> Conectar Dispositivo
        </div>
      </div>
    </div>

    <button id="btn-connect" class="btn btn-cta" onclick="connect()">
      Conectar WhatsApp
    </button>
  </div>

  <!-- ── Info Chips (visible when connected) ── -->
  <div id="info-area" class="hidden">
    <div class="info-chips">
      <span class="chip">
        <span class="chip-icon" id="role-icon"><svg viewBox="0 0 16 16"><path d="M5.56 14.56a.5.5 0 0 1-.09-.98L9.43 8H6a.5.5 0 0 1-.46-.7l3-7a.5.5 0 1 1 .92.4L6.6 7H10a.5.5 0 0 1 .43.76l-4.5 6.5a.5.5 0 0 1-.37.3z"/></svg></span>
        <span id="role-text">—</span>
      </span>
      <span class="chip">
        <span class="chip-icon"><svg viewBox="0 0 16 16"><path d="M14.5 3H7.71l-.86-.86A.48.48 0 0 0 6.5 2h-5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5zM14 13H2V3h4.29l.86.86a.48.48 0 0 0 .35.14H14v9z"/></svg></span>
        <span id="project-count">0</span> projeto(s)
      </span>
    </div>
    <div id="project-tags" class="project-tags"></div>
  </div>

  <!-- ── Messages Card (protagonist when connected) ── -->
  <div class="card" id="messages-card">
    <div class="card-label">
      <span style="display:flex;align-items:center;gap:5px;"><svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M14 1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3.5l2.5 3 2.5-3H14a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM14 10h-3.87L8 12.87 5.87 10H2V2h12v8z"/></svg> Mensagens</span>
      <span id="msg-count" style="font-size:10px;opacity:0.6;"></span>
    </div>
    <div id="chat-area" class="chat-area">
      <div class="chat-empty" id="chat-empty">
        <span class="chat-empty-icon"><svg viewBox="0 0 16 16"><path d="M14 1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3.5l2.5 3 2.5-3H14a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM14 10h-3.87L8 12.87 5.87 10H2V2h12v8z"/></svg></span>
        <span class="chat-empty-text">Nenhuma mensagem ainda.<br/>As mensagens do WhatsApp aparecerão aqui.</span>
      </div>
    </div>
  </div>

  <!-- ── Settings Accordion ── -->
  <div class="accordion" style="margin-bottom:10px;">
    <button class="accordion-trigger" onclick="toggleAccordion(this)" aria-expanded="false">
      <span style="display:flex;align-items:center;gap:5px;"><svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.7-1.3 2 .8.8 2-1.3.7.3.5 2.4h1.2l.5-2.4.7-.3 2 1.3.8-.8-1.3-2 .3-.7 2.4-.5V6.8l-2.4-.5-.3-.7 1.3-2-.8-.8-2 1.3-.7-.3zM9.4 1l.5 2.4L12 2.1l2 2-1.4 2.1 2.4.4v2.8l-2.4.5L14 12l-2 2-2.1-1.4-.5 2.4H6.6l-.5-2.4L4 13.9l-2-2 1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.4.4-2.4h2.8zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-1a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg> Configurações</span>
      <span class="chevron"><svg viewBox="0 0 16 16"><path d="M8 10.5l-4.5-4.5h9z"/></svg></span>
    </button>
    <div class="accordion-content" id="settings-content">
      <label class="setting-label">Modo Bridge</label>
      <select id="setting-mode" class="select-field" onchange="changeSetting('mode', this.value)">
        <option value="auto">Auto (terminal se disponível)</option>
        <option value="agent">Agent (planning interno)</option>
        <option value="terminal">Terminal (relay para AI)</option>
      </select>

      <label class="setting-label">Filtro de Mensagens</label>
      <select id="setting-filter" class="select-field" onchange="changeSetting('chatFilter', this.value)">
        <option value="self">Só self-chat (mais seguro)</option>
        <option value="group">Grupo específico</option>
        <option value="allow_all">Todas (não recomendado)</option>
      </select>

      <div id="group-setting" class="hidden">
        <label class="setting-label">Nome do Grupo</label>
        <input
          id="setting-group"
          class="input-field"
          type="text"
          placeholder="Cappy Dev"
          onchange="changeSetting('allowedGroupName', this.value)"
        />
      </div>
    </div>
  </div>

  <!-- ── Footer ── -->
  <div class="footer">
    <button class="btn btn-ghost" onclick="refresh()" style="gap:5px;"><svg style="width:12px;height:12px;fill:currentColor" viewBox="0 0 16 16"><path d="M13.5 2A.5.5 0 0 0 13 2.5V5a.5.5 0 0 0 .5.5H16a.5.5 0 0 0 0-1h-1.05A5.98 5.98 0 0 0 8.05 2 6 6 0 0 0 2 8a6 6 0 0 0 6 6 5.97 5.97 0 0 0 4.95-2.63.5.5 0 0 0-.83-.56A4.98 4.98 0 0 1 8 13a5 5 0 0 1-5-5 5 5 0 0 1 5-5 4.98 4.98 0 0 1 4.38 2.5H11a.5.5 0 0 0 0 1h3a.5.5 0 0 0 .5-.5V2.5a.5.5 0 0 0-.5-.5h-.5z"/></svg> Atualizar</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentState = 'disconnected';

    function connect() {
      vscode.postMessage({ type: 'connect' });
    }

    function refresh() {
      vscode.postMessage({ type: 'refresh' });
    }

    function changeSetting(key, value) {
      vscode.postMessage({ type: 'setting', key, value });
      if (key === 'chatFilter') {
        document.getElementById('group-setting').classList.toggle('hidden', value !== 'group');
      }
    }

    function toggleAccordion(btn) {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      document.getElementById('settings-content').classList.toggle('open', !expanded);
    }

    // ── Listen to messages from extension ──
    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'qr':
          showQR(msg.data);
          break;
        case 'qr-clear':
          document.getElementById('qr-area').classList.add('hidden');
          setWAStatus('connected');
          break;
        case 'status':
          updateStatus(msg.data);
          break;
        case 'settings':
          updateSettings(msg.data);
          break;
        case 'message':
          addMessage(msg.data);
          break;
      }
    });

    function setWAStatus(status) {
      currentState = status;
      const ring = document.getElementById('status-ring');
      const label = document.getElementById('status-label');
      const hint = document.getElementById('status-hint');
      const btn = document.getElementById('btn-connect');
      const infoArea = document.getElementById('info-area');

      // Reset ring classes
      ring.className = 'status-ring';

      switch (status) {
        case 'connected':
          ring.classList.add('ring-connected');
          ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"/></svg>';
          label.textContent = 'Conectado';
          hint.textContent = 'WhatsApp ativo e recebendo mensagens';
          btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 16 16"><path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"/></svg> Conectado';
          btn.disabled = true;
          btn.className = 'btn btn-primary';
          infoArea.classList.remove('hidden');
          break;

        case 'connecting':
          ring.classList.add('ring-connecting');
          ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M2.006 8.267L.78 9.5 0 8.73l2.09-2.07.76.01 2.09 2.12-.76.76-1.167-1.18a5 5 0 0 0 9.4 1.96l.96.4a6 6 0 0 1-11.36-2.45zM14 8c0-.6-.1-1.16-.3-1.68l.96-.4A6 6 0 0 1 8.05 14a6 6 0 0 1-5.72-4.29l-.96.4A5 5 0 0 0 13 8h1zM8.05 2a6 6 0 0 1 5.72 4.29l.96-.4A5 5 0 0 0 3 8H2c0 .6.1 1.16.3 1.68l-.96.4A6 6 0 0 1 8.05 2z"/></svg>';
          label.textContent = 'Conectando...';
          hint.textContent = 'Estabelecendo conexão com o WhatsApp';
          btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor;animation:ring-spin 1.2s linear infinite" viewBox="0 0 16 16"><path d="M2.006 8.267L.78 9.5 0 8.73l2.09-2.07.76.01 2.09 2.12-.76.76-1.167-1.18a5 5 0 0 0 9.4 1.96l.96.4a6 6 0 0 1-11.36-2.45z"/></svg> Conectando...';
          btn.disabled = true;
          btn.className = 'btn btn-primary';
          infoArea.classList.add('hidden');
          break;

        case 'qr_ready':
          ring.classList.add('ring-qr');
          ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M6 1H1v5h5V1zM2 2h3v3H2V2zm13-1h-5v5h5V1zm-4 1h3v3h-3V2zM1 10h5v5H1v-5zm1 1v3h3v-3H2zm9-1h1v1h-1v-1zm-1 1h1v1h-1v1h-1v-2h1zm2 0h1v1h2v2h-1v-1h-1v2h-2v-1h1v-1h-1v-1h1v-1zm1 0h2v1h-2v-1zm1 3h1v2h-2v-1h1v-1z"/></svg>';
          label.textContent = 'Escaneie o QR Code';
          hint.textContent = 'Use o WhatsApp no seu celular';
          btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 16 16"><path d="M6 1H1v5h5V1zM2 2h3v3H2V2zm13-1h-5v5h5V1zm-4 1h3v3h-3V2zM1 10h5v5H1v-5zm1 1v3h3v-3H2z"/></svg> Aguardando escaneamento...';
          btn.disabled = true;
          btn.className = 'btn btn-primary';
          infoArea.classList.add('hidden');
          break;

        default:
          ring.classList.add('ring-disconnected');
          ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M11 1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM5 2h6v10H5V2zm2.5 11.5a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0z"/></svg>';
          label.textContent = 'Desconectado';
          hint.textContent = 'Conecte ao WhatsApp para começar';
          btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 16 16"><path d="M11 1H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM5 2h6v10H5V2zm2.5 11.5a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0z"/></svg> Conectar WhatsApp';
          btn.disabled = false;
          btn.className = 'btn btn-cta';
          infoArea.classList.add('hidden');
          break;
      }
    }

    function showQR(dataUri) {
      document.getElementById('qr-area').classList.remove('hidden');
      document.getElementById('qr-img').src = dataUri;
      setWAStatus('qr_ready');
    }

    function updateStatus(status) {
      // Role
      const roleEl = document.getElementById('role-text');
      const roleIcon = document.getElementById('role-icon');
      if (status.role) {
        roleEl.textContent = status.role === 'server' ? 'Server' : 'Satellite';
        roleIcon.innerHTML = status.role === 'server'
          ? '<svg viewBox="0 0 16 16"><path d="M3 3h10v4H3V3zm1 1v2h8V4H4zm-1 5h10v4H3V9zm1 1v2h8v-2H4z"/></svg>'
          : '<svg viewBox="0 0 16 16"><path d="M8 1a.5.5 0 0 0-.5.5v3.03a4.5 4.5 0 0 0-4 4.47.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5 4.5 4.5 0 0 0-4-4.47V1.5A.5.5 0 0 0 8 1zm0 5a3.5 3.5 0 0 1 3.43 3H4.57A3.5 3.5 0 0 1 8 6zM1 12h14v1H1v-1zm2 2h10v1H3v-1z"/></svg>';
      } else {
        roleEl.textContent = '—';
      }

      // Check if we are a satellite (client with serverInfo)
      if (status.role === 'client' && status.serverInfo) {
        setSatelliteStatus(status.serverInfo);
      } else {
        // WhatsApp
        setWAStatus(status.whatsapp);
      }

      // Projects
      document.getElementById('project-count').textContent = status.projects.length;
      const tags = document.getElementById('project-tags');
      tags.innerHTML = status.projects
        .map(p => '<span class="project-tag"><svg style="width:11px;height:11px;fill:currentColor;vertical-align:-1px;margin-right:3px" viewBox="0 0 16 16"><path d="M14.5 3H7.71l-.86-.86A.48.48 0 0 0 6.5 2h-5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5zM14 13H2V3h4.29l.86.86a.48.48 0 0 0 .35.14H14v9z"/></svg>' + escapeHtml(p) + '</span>')
        .join('');
    }

    function setSatelliteStatus(serverInfo) {
      currentState = 'satellite';
      const ring = document.getElementById('status-ring');
      const label = document.getElementById('status-label');
      const hint = document.getElementById('status-hint');
      const btn = document.getElementById('btn-connect');
      const infoArea = document.getElementById('info-area');

      ring.className = 'status-ring ring-connected';
      ring.querySelector('.ring-icon').innerHTML = '<svg viewBox="0 0 16 16"><path d="M8 1a.5.5 0 0 0-.5.5v3.03a4.5 4.5 0 0 0-4 4.47.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5 4.5 4.5 0 0 0-4-4.47V1.5A.5.5 0 0 0 8 1zm0 5a3.5 3.5 0 0 1 3.43 3H4.57A3.5 3.5 0 0 1 8 6zM1 12h14v1H1v-1zm2 2h10v1H3v-1z"/></svg>';
      label.textContent = 'Conectado como Satellite';
      hint.innerHTML = 'Server ativo no workspace <b>' + escapeHtml(serverInfo.serverProject) + '</b>';
      btn.innerHTML = '<svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 16 16"><path d="M8 1a.5.5 0 0 0-.5.5v3.03a4.5 4.5 0 0 0-4 4.47.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5 4.5 4.5 0 0 0-4-4.47V1.5A.5.5 0 0 0 8 1z"/></svg> Server: ' + escapeHtml(serverInfo.serverProject);
      btn.disabled = true;
      btn.className = 'btn btn-primary';
      infoArea.classList.remove('hidden');
    }

    function updateSettings(settings) {
      document.getElementById('setting-mode').value = settings.mode;
      document.getElementById('setting-filter').value = settings.chatFilter;
      document.getElementById('setting-group').value = settings.allowedGroupName;
      document.getElementById('group-setting').classList.toggle('hidden', settings.chatFilter !== 'group');
    }

    let msgCount = 0;

    function addMessage(data) {
      // Hide empty state
      const empty = document.getElementById('chat-empty');
      if (empty) empty.remove();

      const area = document.getElementById('chat-area');
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble msg-' + data.direction;

      const arrowSvg = data.direction === 'in'
        ? '<svg style="width:11px;height:11px;fill:currentColor;vertical-align:-1px" viewBox="0 0 16 16"><path d="M7.5 1v9.8L4.15 7.45l-.71.71L8 12.72l4.56-4.56-.71-.71L8.5 10.8V1h-1z"/></svg>'
        : '<svg style="width:11px;height:11px;fill:currentColor;vertical-align:-1px" viewBox="0 0 16 16"><path d="M8.5 15V5.2l3.35 3.35.71-.71L8 3.28 3.44 7.84l.71.71L7.5 5.2V15h1z"/></svg>';
      bubble.innerHTML =
        '<div class="msg-from">' + arrowSvg + ' ' + escapeHtml(data.from) + '</div>' +
        '<div class="msg-text">' + escapeHtml(data.text) + '</div>' +
        '<div class="msg-time">' + data.time + '</div>';

      area.appendChild(bubble);
      area.scrollTop = area.scrollHeight;

      msgCount++;
      document.getElementById('msg-count').textContent = '(' + msgCount + ')';
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
  }
}
