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

    webviewView.webview.html = this.getHtmlContent();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((msg) => {
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
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
    }

    .section {
      margin-bottom: 16px;
      padding: 12px;
      background: var(--vscode-editor-background);
      border-radius: 6px;
      border: 1px solid var(--vscode-widget-border, transparent);
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .status-connected {
      background: rgba(76, 175, 80, 0.15);
      color: #4caf50;
    }

    .status-disconnected {
      background: rgba(244, 67, 54, 0.15);
      color: #f44336;
    }

    .status-connecting {
      background: rgba(255, 193, 7, 0.15);
      color: #ffc107;
    }

    .status-qr {
      background: rgba(33, 150, 243, 0.15);
      color: #2196f3;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .btn {
      width: 100%;
      padding: 8px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: opacity 0.2s;
    }

    .btn:hover { opacity: 0.85; }

    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      gap: 8px;
    }

    .qr-canvas {
      background: white;
      padding: 8px;
      border-radius: 8px;
      max-width: 200px;
    }

    .qr-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      line-height: 1.4;
    }

    .project-list {
      list-style: none;
    }

    .project-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      font-size: 12px;
    }

    .project-icon {
      font-size: 14px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 12px;
    }

    .info-label {
      color: var(--vscode-descriptionForeground);
    }

    .select-field {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      font-size: 12px;
      font-family: inherit;
      margin-top: 4px;
      margin-bottom: 8px;
    }

    .input-field {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      font-size: 12px;
      font-family: inherit;
      margin-top: 4px;
      outline: none;
    }

    .input-field:focus, .select-field:focus {
      border-color: var(--vscode-focusBorder);
      outline: none;
    }

    .setting-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
      display: block;
    }

    .hidden { display: none !important; }

    .logo {
      text-align: center;
      font-size: 24px;
      margin-bottom: 4px;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .pulse { animation: pulse 2s infinite; }
  </style>
</head>
<body>
  <div class="logo">🦫</div>

  <!-- WhatsApp Connection -->
  <div class="section">
    <div class="section-title">
      📱 WhatsApp
      <span id="wa-status" class="status-badge status-disconnected">
        <span class="dot"></span> Desconectado
      </span>
    </div>

    <div id="qr-area" class="hidden">
      <div class="qr-container">
        <canvas id="qr-canvas" class="qr-canvas" width="200" height="200"></canvas>
        <div class="qr-hint">
          Abra o WhatsApp → Dispositivos Conectados → Conectar Dispositivo
        </div>
      </div>
    </div>

    <div id="connected-area" class="hidden">
      <div class="info-row">
        <span class="info-label">Status</span>
        <span id="wa-status-text">Conectado</span>
      </div>
    </div>

    <button id="btn-connect" class="btn btn-primary" onclick="connect()">
      📱 Conectar WhatsApp
    </button>
  </div>

  <!-- Status -->
  <div class="section">
    <div class="section-title">
      📊 Status
    </div>
    <div class="info-row">
      <span class="info-label">Role</span>
      <span id="role-text">—</span>
    </div>
    <div class="info-row">
      <span class="info-label">Projetos</span>
      <span id="project-count">0</span>
    </div>
    <ul id="project-list" class="project-list"></ul>
  </div>

  <!-- Settings -->
  <div class="section">
    <div class="section-title">⚙️ Configurações</div>

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

  <button class="btn btn-secondary" onclick="refresh()">🔄 Atualizar</button>

  <script>
    const vscode = acquireVsCodeApi();

    function connect() {
      vscode.postMessage({ type: 'connect' });
    }

    function refresh() {
      vscode.postMessage({ type: 'refresh' });
    }

    function changeSetting(key, value) {
      vscode.postMessage({ type: 'setting', key, value });

      // Toggle group name field
      if (key === 'chatFilter') {
        document.getElementById('group-setting').classList.toggle('hidden', value !== 'group');
      }
    }

    // Handle messages from extension
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
      }
    });

    function setWAStatus(status) {
      const badge = document.getElementById('wa-status');
      const connArea = document.getElementById('connected-area');
      const btn = document.getElementById('btn-connect');

      badge.className = 'status-badge';

      switch (status) {
        case 'connected':
          badge.classList.add('status-connected');
          badge.innerHTML = '<span class="dot"></span> Conectado';
          connArea.classList.remove('hidden');
          btn.textContent = '✅ Conectado';
          btn.disabled = true;
          break;

        case 'connecting':
          badge.classList.add('status-connecting');
          badge.innerHTML = '<span class="dot pulse"></span> Conectando...';
          btn.textContent = '⏳ Conectando...';
          btn.disabled = true;
          break;

        case 'qr_ready':
          badge.classList.add('status-qr');
          badge.innerHTML = '<span class="dot pulse"></span> QR Code';
          btn.textContent = '📷 Escaneie o QR';
          btn.disabled = true;
          break;

        default:
          badge.classList.add('status-disconnected');
          badge.innerHTML = '<span class="dot"></span> Desconectado';
          connArea.classList.add('hidden');
          btn.textContent = '📱 Conectar WhatsApp';
          btn.disabled = false;
          break;
      }
    }

    function showQR(qrText) {
      document.getElementById('qr-area').classList.remove('hidden');
      setWAStatus('qr_ready');

      // Draw QR code on canvas
      const canvas = document.getElementById('qr-canvas');
      drawQR(canvas, qrText);
    }

    function drawQR(canvas, text) {
      // Simple QR-like visualization using the text data
      // In production, use a proper QR library. For now, render text.
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = 'black';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';

      // The QR string from Baileys is already encoded
      // We'll render it as a grid pattern
      const size = Math.ceil(Math.sqrt(text.length));
      const cellSize = Math.floor(180 / size);
      const offset = (200 - size * cellSize) / 2;

      for (let i = 0; i < text.length; i++) {
        const x = (i % size) * cellSize + offset;
        const y = Math.floor(i / size) * cellSize + offset;
        if (text.charCodeAt(i) % 2 === 0) {
          ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
        }
      }
    }

    function updateStatus(status) {
      // Role
      const roleEl = document.getElementById('role-text');
      if (status.role) {
        roleEl.textContent = status.role === 'server' ? '🖥️ Server' : '📡 Client';
      } else {
        roleEl.textContent = '—';
      }

      // WhatsApp
      setWAStatus(status.whatsapp);

      // Projects
      const list = document.getElementById('project-list');
      const count = document.getElementById('project-count');
      count.textContent = status.projects.length;
      list.innerHTML = status.projects
        .map(p => '<li class="project-item"><span class="project-icon">📁</span> ' + p + '</li>')
        .join('');
    }

    function updateSettings(settings) {
      document.getElementById('setting-mode').value = settings.mode;
      document.getElementById('setting-filter').value = settings.chatFilter;
      document.getElementById('setting-group').value = settings.allowedGroupName;
      document.getElementById('group-setting').classList.toggle('hidden', settings.chatFilter !== 'group');
    }
  </script>
</body>
</html>`;
  }
}
