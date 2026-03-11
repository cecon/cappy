/**
 * @fileoverview Cappy WebView Provider — manages the sidebar Dashboard lifecycle.
 * @module webview/cappy-webview
 *
 * Single Responsibility: WebviewViewProvider lifecycle, bridge ↔ webview communication.
 * HTML/CSS/JS are in dashboard.html.ts, dashboard.css.ts, dashboard.js.ts.
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CappyBridge } from '../../../../nivel2/infrastructure/bridge/cappy-bridge';
import { generateDashboardHtml } from './dashboard.html';

/** Status object shape from the bridge */
interface BridgeStatus {
  role: string | null;
  whatsapp: string;
  projects: string[];
  serverInfo?: { serverProject: string; whatsappStatus: string };
}

/**
 * WebView provider for the Cappy sidebar panel.
 * Shows WhatsApp QR code, connection status, project list, and settings.
 */
export class CappyWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cappy.dashboard';

  private view: vscode.WebviewView | null = null;
  private bridge: CappyBridge | null = null;
  private qrCode: string | null = null;
  private lastStatus: BridgeStatus | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {}

  // ────────────────────────── Public API ──────────────────────────

  /** Set bridge reference. Triggers immediate re-render if webview is visible. */
  setBridge(bridge: CappyBridge): void {
    this.bridge = bridge;
    if (this.view) {
      this.rerender();
    }
  }

  /** Update QR code displayed in the Dashboard */
  updateQRCode(qr: string): void {
    this.qrCode = qr;
    this.postMessage({ type: 'qr', data: qr });
  }

  /** Clear QR code (connected successfully) */
  clearQRCode(): void {
    this.qrCode = null;
    this.postMessage({ type: 'qr-clear' });
  }

  /**
   * Update connection status. Re-renders the entire webview HTML
   * to guarantee the Dashboard reflects the correct state
   * (postMessage can silently fail if webview context is stale).
   */
  updateStatus(status: BridgeStatus): void {
    const previousWhatsapp = this.lastStatus?.whatsapp;
    this.lastStatus = status;

    // If the whatsapp state changed significantly, re-render HTML
    if (previousWhatsapp !== status.whatsapp || previousWhatsapp === undefined) {
      this.rerender();
    } else {
      // Minor update — try postMessage
      this.postMessage({ type: 'status', data: status });
    }
  }

  /** Add a message to the chat log */
  addMessage(from: string, text: string, direction: 'in' | 'out'): void {
    this.postMessage({
      type: 'message',
      data: {
        from, text, direction,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    });
  }

  /** Post message to the webview (for updates that don't need HTML re-render) */
  postMessage(msg: any): void {
    this.view?.webview.postMessage(msg);
  }

  // ────────────────────────── Lifecycle ──────────────────────────

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

    // Render HTML with current state baked in
    webviewView.webview.html = this.buildHtml();

    // Handle messages from webview → extension
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
          this.rerender();
          break;
        case 'webview-ready':
          this.sendSettings();
          break;
        case 'scheduler-add':
          vscode.commands.executeCommand('cappy.scheduler.add', msg.data);
          break;
        case 'scheduler-toggle':
          vscode.commands.executeCommand('cappy.scheduler.toggle', msg.data);
          break;
        case 'scheduler-remove':
          vscode.commands.executeCommand('cappy.scheduler.remove', msg.data);
          break;
        case 'scheduler-run':
          vscode.commands.executeCommand('cappy.scheduler.run', msg.data);
          break;
        case 'notebook-refresh':
          this.sendNotebooksList();
          break;
      }
    });

    // Sync when panel becomes visible again
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.rerender();
      }
    });
  }

  // ────────────────────────── Private ──────────────────────────

  /**
   * Re-render the entire webview HTML with fresh state.
   * This is the nuclear but reliable approach — no postMessage dependency.
   */
  private rerender(): void {
    if (!this.view) return;

    // Fetch latest status from bridge if available
    if (this.bridge) {
      this.lastStatus = this.bridge.getStatus();
    }

    this.view.webview.html = this.buildHtml();

    // Re-send QR if we have one (not baked into initial HTML)
    if (this.qrCode) {
      this.postMessage({ type: 'qr', data: this.qrCode });
    }

    // Send settings after script initializes
    setTimeout(() => this.sendSettings(), 100);
  }

  /** Build the full HTML string with current state injected */
  private buildHtml(): string {
    const iconUri = this.view
      ? this.view.webview.asWebviewUri(
          vscode.Uri.joinPath(this.extensionUri, 'src', 'assets', 'icon.png'),
        ).toString()
      : '';

    const currentStatus = this.bridge ? this.bridge.getStatus() : this.lastStatus;
    const initialStatusJson = currentStatus ? JSON.stringify(currentStatus) : 'null';
    const initialNotebooksJson = JSON.stringify(this.getNotebooksList());

    return generateDashboardHtml({ iconUri, initialStatusJson, initialNotebooksJson });
  }

  /** Send current settings to the webview */
  private sendSettings(): void {
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

  /** Send notebooks list to the webview via postMessage */
  private sendNotebooksList(): void {
    this.postMessage({ type: 'notebooks-list', data: this.getNotebooksList() });
  }

  /** Read notebook summaries directly from .cappy/notebooks in the workspace */
  private getNotebooksList(): Array<{ name: string; chunkCount: number; sourceCount: number; updated: string }> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return [];

      const notebooksDir = path.join(workspaceFolder.uri.fsPath, '.cappy', 'notebooks');
      if (!fs.existsSync(notebooksDir)) return [];

      const entries = fs.readdirSync(notebooksDir);
      const results: Array<{ name: string; chunkCount: number; sourceCount: number; updated: string }> = [];

      for (const entry of entries) {
        const jsonPath = path.join(notebooksDir, entry, 'notebook.json');
        if (!fs.existsSync(jsonPath)) continue;

        try {
          const raw = fs.readFileSync(jsonPath, 'utf-8');
          const data = JSON.parse(raw);
          results.push({
            name: data.meta?.name || entry,
            chunkCount: data.chunks?.length || 0,
            sourceCount: data.meta?.sources?.length || 0,
            updated: data.meta?.updated || '',
          });
        } catch {
          // Skip malformed notebooks
        }
      }

      return results;
    } catch {
      return [];
    }
  }
}
